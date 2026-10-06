import cron from "node-cron";
import { prisma } from "../../config/database.js";
import { NxlinkApiService } from "../../services/nxlink-api.service.js";
import { NxlinkAiService } from "../../services/nxlink-ai.service.js";
import { CdrService } from "../cdr/cdr.service.js";
import { DownloadService } from "../download/download.service.js";
import { RuleEngine } from "../rules/rule-engine.js";
import { logger } from "../../utils/logger.js";

export class SchedulerService {
  private static instance: SchedulerService | null = null;
  private cronJob: cron.ScheduledTask | null = null;
  private cdrService = new CdrService();
  private ruleEngine = new RuleEngine();
  private isRunning = false;

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  async start() {
    const config = await prisma.schedulerConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      logger.warn("No active scheduler config found");
      return;
    }

    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.cronJob = cron.schedule(config.cronExpression, async () => {
      if (this.isRunning) {
        logger.warn("Scheduler already running, skipping");
        return;
      }

      this.isRunning = true;
      try {
        await this.runSync();
      } catch (error) {
        logger.error(`Scheduler error: ${error}`);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info(`Scheduler started with cron: ${config.cronExpression}`);
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Scheduler stopped");
    }
  }

  async runManual() {
    if (this.isRunning) {
      throw new Error("Scheduler already running");
    }

    this.isRunning = true;
    try {
      return await this.runSync();
    } finally {
      this.isRunning = false;
    }
  }

  private async runSync() {
    const runId = Date.now();
    logger.info(
      `[Scheduler #${runId}] ========== Starting scheduled sync ==========`,
    );

    const config = await prisma.schedulerConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      logger.warn(
        `[Scheduler #${runId}] No active scheduler config found — skipping`,
      );
      return;
    }

    logger.info(
      `[Scheduler #${runId}] Config: cron=${config.cronExpression}, lookback=${config.lookbackHours}h, pageSize=${config.pageSize}, storage=${config.storagePath}`,
    );

    const activeApiConfig = await prisma.apiConfig.findFirst({
      where: { isActive: true },
    });

    if (!activeApiConfig) {
      logger.warn(
        `[Scheduler #${runId}] No active API config found — skipping`,
      );
      return;
    }

    logger.info(
      `[Scheduler #${runId}] Using API config: ${activeApiConfig.name} (${activeApiConfig.region}) → ${activeApiConfig.apiGateway}`,
    );

    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - config.lookbackHours * 3600;

    logger.info(
      `[Scheduler #${runId}] Querying CDRs: startTime=${new Date(startTime * 1000).toISOString()} → endTime=${new Date(endTime * 1000).toISOString()}`,
    );

    const apiService = new NxlinkApiService({
      apiGateway: activeApiConfig.apiGateway,
      accessKey: activeApiConfig.accessKey,
      accessSecret: activeApiConfig.secretKey,
      bizType: activeApiConfig.bizType,
      action: activeApiConfig.action,
    });

    const syncStart = Date.now();
    const syncResult = await this.cdrService.syncFromApi(
      apiService,
      startTime,
      endTime,
    );
    const syncElapsed = Date.now() - syncStart;

    logger.info(
      `[Scheduler #${runId}] CDR sync complete in ${syncElapsed}ms: ${syncResult.total} records (${syncResult.synced} new, ${syncResult.updated} updated)`,
    );

    // AI Voice Bot Sync if token URL is configured
    const aiTokenUrl = activeApiConfig.aiTokenUrl || process.env.NXAI_TOKEN_URL;
    if (aiTokenUrl) {
      try {
        const aiService = new NxlinkAiService({
          aiTokenUrl,
          aiAppUrl: activeApiConfig.aiAppUrl || "https://app.nxlink.ai",
        });
        const botSyncResult = await this.cdrService.syncAiBotFromApi(
          aiService,
          startTime,
          endTime,
        );
        logger.info(
          `[Scheduler #${runId}] AI Voice Bot sync complete: ${botSyncResult.total} records (${botSyncResult.synced} new, ${botSyncResult.updated} updated)`,
        );
      } catch (botError: any) {
        logger.warn(`[Scheduler #${runId}] AI Voice Bot sync error: ${botError.message || botError}`);
      }
    }

    const downloadService = new DownloadService(config.storagePath);

    const pendingCdrs = await prisma.cdrRecord.findMany({
      where: {
        recordUrl: { not: null },
        startTime: { gte: BigInt(startTime * 1000) },
      },
    });

    logger.info(
      `[Scheduler #${runId}] ${pendingCdrs.length} CDRs with recordings found in time range`,
    );

    let downloaded = 0;
    let failed = 0;
    let skipped = 0;
    let totalSize = 0;

    for (const cdr of pendingCdrs) {
      const match = await this.ruleEngine.evaluateCdr(cdr);

      if (!match.matched) {
        skipped++;
        continue;
      }

      const result = await downloadService.downloadRecording(
        cdr.id,
        match.ruleId ?? undefined,
      );

      if (result.success) {
        downloaded++;
        totalSize += result.fileSize || 0;
      } else {
        failed++;
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const today = new Date(todayStr);

    await prisma.dailyLog.upsert({
      where: { logDate: today },
      update: {
        totalCdrsSynced: { increment: syncResult.total },
        totalDownloadsAttempted: { increment: downloaded + failed },
        totalDownloadsSuccess: { increment: downloaded },
        totalDownloadsFailed: { increment: failed },
        totalDownloadsSkipped: { increment: skipped },
        totalSizeBytes: { increment: BigInt(totalSize) },
      },
      create: {
        logDate: today,
        totalCdrsSynced: syncResult.total,
        totalDownloadsAttempted: downloaded + failed,
        totalDownloadsSuccess: downloaded,
        totalDownloadsFailed: failed,
        totalDownloadsSkipped: skipped,
        totalSizeBytes: BigInt(totalSize),
      },
    });

    logger.info(
      `[Scheduler #${runId}] ========== Sync complete: ${syncResult.total} CDRs synced, ${downloaded} downloaded (${(totalSize / 1024 / 1024).toFixed(1)}MB), ${failed} failed, ${skipped} skipped ==========`,
    );

    return {
      synced: syncResult.total,
      downloaded,
      failed,
      skipped,
    };
  }
}
