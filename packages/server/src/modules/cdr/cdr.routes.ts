import { Router } from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { CdrService } from "./cdr.service.js";
import { NxlinkApiService } from "../../services/nxlink-api.service.js";
import { NxlinkAiService } from "../../services/nxlink-ai.service.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { logAudit } from "../../utils/audit.js";
import { DownloadService } from "../download/download.service.js";
import { isEncryptionEnabled, decrypt } from "../../utils/crypto.js";
import { RuleEngine } from "../rules/rule-engine.js";

const router = Router();
const cdrService = new CdrService();
const downloadService = new DownloadService(
  process.env.RECORDINGS_PATH || "./recordings",
);

router.use(authenticate);

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      answered,
      direction,
      recordingType,
      name,
      names,
      caller,
      callee,
      callId,
      orderId,
      startTime,
      endTime,
      minDuration,
      page = "1",
      size = "20",
    } = req.query;

    const result = await cdrService.query({
      answered: answered ? Number(answered) : undefined,
      direction: direction ? Number(direction) : undefined,
      recordingType: recordingType as string | undefined,
      name: name as string | undefined,
      names: names ? (names as string).split(",") : undefined,
      caller: caller as string | undefined,
      callee: callee as string | undefined,
      callId: callId as string | undefined,
      orderId: orderId as string | undefined,
      startTime: startTime ? Number(startTime) : undefined,
      endTime: endTime ? Number(endTime) : undefined,
      minDuration: minDuration ? Number(minDuration) : undefined,
      page: Number(page),
      size: Number(size),
      userId: req.user?.userId,
    });

    res.json(result);
  } catch (error) {
    logger.error(`List CDRs error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const record = await cdrService.getById(Number(req.params.id));

    if (!record) {
      return res.status(404).json({ error: "CDR record not found" });
    }

    res.json(record);
  } catch (error) {
    logger.error(`Get CDR error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sync", authenticate, async (req: AuthRequest, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res
        .status(400)
        .json({ error: "startTime and endTime are required" });
    }

    const activeConfig = await prisma.apiConfig.findFirst({
      where: { isActive: true },
    });

    if (!activeConfig) {
      return res
        .status(400)
        .json({ error: "No active API configuration found" });
    }

    const apiService = new NxlinkApiService({
      apiGateway: activeConfig.apiGateway,
      accessKey: activeConfig.accessKey,
      accessSecret: activeConfig.secretKey,
      bizType: activeConfig.bizType,
      action: activeConfig.action,
    });

    const result = await cdrService.syncFromApi(apiService, startTime, endTime);

    // AI Voice Bot sync if configured
    const hasAiAuth =
      activeConfig.platToken ||
      activeConfig.aiTokenUrl ||
      process.env.NXAI_TOKEN_URL;
    let botResult = { synced: 0, updated: 0, total: 0 };
    if (hasAiAuth) {
      try {
        const aiService = new NxlinkAiService({
          aiTokenUrl: activeConfig.aiTokenUrl,
          aiAppUrl: activeConfig.aiAppUrl || "https://app.nxlink.ai",
          platToken: activeConfig.platToken,
        });
        botResult = await cdrService.syncAiBotFromApi(aiService, startTime, endTime);
      } catch (botErr: any) {
        logger.warn(`AI Voice Bot sync in /sync failed: ${botErr.message || botErr}`);
      }
    }

    const combinedResult = {
      synced: result.synced + botResult.synced,
      updated: result.updated + botResult.updated,
      total: result.total + botResult.total,
      agentSynced: result.synced,
      botSynced: botResult.synced,
    };

    logger.info(`CDR sync triggered by ${req.user?.username}. Evaluating download rules...`);

    const schedulerConfig = await prisma.schedulerConfig.findFirst({
      where: { isActive: true },
    });
    const storagePath =
      process.env.RECORDINGS_PATH ||
      schedulerConfig?.storagePath ||
      "./recordings";

    const localDownloadService = new DownloadService(storagePath);
    const ruleEngine = new RuleEngine();

    const pendingCdrs = await prisma.cdrRecord.findMany({
      where: {
        recordUrl: { not: null },
        startTime: {
          gte: BigInt(startTime * 1000),
          lte: BigInt(endTime * 1000),
        },
      },
    });

    let downloaded = 0;
    let failed = 0;

    for (const cdr of pendingCdrs) {
      const match = await ruleEngine.evaluateCdr(cdr);
      if (match.matched) {
        const dlResult = await localDownloadService.downloadRecording(
          cdr.id,
          match.ruleId ?? undefined,
        );
        if (dlResult.success) {
          downloaded++;
        } else {
          failed++;
        }
      }
    }

    logger.info(
      `Post-sync downloader complete: ${downloaded} downloaded, ${failed} failed.`,
    );

    res.json({
      ...combinedResult,
      downloaded,
      failed,
    });
  } catch (error: any) {
    logger.error(`Sync CDRs error: ${error}`);
    res.status(500).json({ error: error.message || "Sync failed" });
  }
});

router.post("/export", authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      answered,
      direction,
      name,
      caller,
      callee,
      callId,
      orderId,
      startTime,
      endTime,
      dryRun,
    } = req.body;

    const where: Record<string, unknown> = { recordUrl: { not: null } };
    if (answered !== undefined) where.answered = answered;
    if (direction !== undefined && direction !== 0) where.direction = direction;
    if (name) where.agentName = { contains: name };
    if (caller) where.caller = { contains: caller };
    if (callee) where.callee = { contains: callee };
    if (callId) where.callId = { contains: callId };
    if (orderId) where.orderId = { contains: orderId };
    if (startTime !== undefined) where.startTime = { gte: BigInt(startTime * 1000) };
    if (endTime !== undefined) where.endTime = { lte: BigInt(endTime * 1000) };

    const cdrs = await prisma.cdrRecord.findMany({ where });

    const downloadedLogs = await prisma.downloadLog.findMany({
      where: {
        cdrId: { in: cdrs.map((c) => c.id) },
        status: "success",
        filePath: { not: null },
      },
    });

    if (downloadedLogs.length === 0) {
      return res
        .status(404)
        .json({ error: "No downloaded recordings match the filters" });
    }

    const uniquePaths = new Map<string, { cdr: any; log: any }>();
    for (const log of downloadedLogs) {
      if (log.filePath && !uniquePaths.has(log.filePath)) {
        const cdr = cdrs.find((c) => c.id === log.cdrId);
        if (cdr) uniquePaths.set(log.filePath, { cdr, log });
      }
    }

    if (dryRun) {
      return res.json({ count: uniquePaths.size });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="recordings_${Date.now()}.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      logger.error(`Export ZIP error: ${err}`);
      if (!res.headersSent) res.status(500).json({ error: "Export failed" });
    });

    archive.pipe(res);

    for (const [filePath, { cdr }] of uniquePaths) {
      if (fs.existsSync(filePath)) {
        const agentName = cdr.agentName || "unknown";
        const archivePath = `${agentName}/${cdr.callId}.mp3`;
        archive.file(filePath, { name: archivePath });
      }
    }

    await archive.finalize();

    logger.info(
      `Export: ${uniquePaths.size} recordings exported by ${req.user?.username}`,
    );

    logAudit({
      userId: req.user?.userId,
      action: "export",
      entityType: "recording",
      details: {
        count: uniquePaths.size,
        filters: req.body,
      },
      ipAddress: req.ip || undefined,
      userAgent: req.headers["user-agent"],
    });
  } catch (error: any) {
    logger.error(`Export CDRs error: ${error}`);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

async function streamZip(
  res: any,
  fileMap: Map<string, string>,
  count: number,
  userId?: number,
  ip?: string,
  ua?: string,
) {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="recordings_${Date.now()}.zip"`,
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    logger.error(`Export ZIP error: ${err}`);
  });
  archive.pipe(res);

  for (const [filePath, archivePath] of fileMap) {
    if (fs.existsSync(filePath)) {
      // Decrypt encrypted files before adding to ZIP
      if (
        filePath.endsWith(".enc") ||
        (isEncryptionEnabled() && !filePath.endsWith(".mp3"))
      ) {
        try {
          const encryptedData = fs.readFileSync(filePath);
          const decryptedData = decrypt(encryptedData);
          archive.append(decryptedData, {
            name: archivePath.replace(/\.enc$/, ""),
          });
        } catch (decryptError: any) {
          logger.error(
            `Failed to decrypt ${filePath}: ${decryptError.message}`,
          );
        }
      } else {
        archive.file(filePath, { name: archivePath });
      }
    }
  }

  await archive.finalize();

  logAudit({
    userId,
    action: "export",
    entityType: "recording",
    details: { count },
    ipAddress: ip,
    userAgent: ua,
  });
}

router.post("/export-single", authenticate, async (req: AuthRequest, res) => {
  try {
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: "callId is required" });

    const cdr = await prisma.cdrRecord.findFirst({ where: { callId } });
    if (!cdr) return res.status(404).json({ error: "CDR not found" });

    const log = await prisma.downloadLog.findFirst({
      where: { cdrId: cdr.id, status: "success", filePath: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    if (!log?.filePath)
      return res
        .status(404)
        .json({ error: "Recording not downloaded locally" });

    const agentName = cdr.agentName || "unknown";
    const fileMap = new Map<string, string>();
    fileMap.set(log.filePath, `${agentName}/${cdr.callId}.mp3`);

    await streamZip(
      res,
      fileMap,
      1,
      req.user?.userId,
      req.ip,
      req.headers["user-agent"] as string,
    );
  } catch (error: any) {
    logger.error(`Export single error: ${error}`);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

router.post("/export-bulk", authenticate, async (req: AuthRequest, res) => {
  try {
    const { callIds } = req.body;
    if (!callIds || !Array.isArray(callIds) || callIds.length === 0) {
      return res.status(400).json({ error: "callIds array is required" });
    }

    const cdrs = await prisma.cdrRecord.findMany({
      where: { callId: { in: callIds } },
    });
    const logs = await prisma.downloadLog.findMany({
      where: {
        cdrId: { in: cdrs.map((c) => c.id) },
        status: "success",
        filePath: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    const fileMap = new Map<string, string>();
    for (const cdr of cdrs) {
      const log = logs.find((l) => l.cdrId === cdr.id);
      if (log?.filePath) {
        const agentName = cdr.agentName || "unknown";
        fileMap.set(log.filePath, `${agentName}/${cdr.callId}.mp3`);
      }
    }

    if (fileMap.size === 0)
      return res
        .status(404)
        .json({ error: "No downloaded recordings found for selected calls" });

    await streamZip(
      res,
      fileMap,
      fileMap.size,
      req.user?.userId,
      req.ip,
      req.headers["user-agent"] as string,
    );
  } catch (error: any) {
    logger.error(`Export bulk error: ${error}`);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

export default router;
