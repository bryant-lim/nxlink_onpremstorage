import { Router } from "express";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { DownloadService } from "./download.service.js";

const router = Router();
const downloadService = new DownloadService(
  process.env.RECORDINGS_PATH || "./recordings",
);

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const { page = "1", size = "20", status } = req.query;

    const where: Record<string, unknown> = {};
    if (status && typeof status === "string") {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.downloadLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(size),
        take: Number(size),
      }),
      prisma.downloadLog.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page: Number(page),
      size: Number(size),
      totalPages: Math.ceil(total / Number(size)),
    });
  } catch (error) {
    logger.error(`List download logs error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/retry", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = BigInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    );

    const log = await prisma.downloadLog.findUnique({
      where: { id },
      include: { cdr: true },
    });

    if (!log) {
      return res.status(404).json({ error: "Download log not found" });
    }

    if (log.status !== "failed") {
      return res.status(400).json({ error: "Can only retry failed downloads" });
    }

    await prisma.downloadLog.update({
      where: { id },
      data: {
        status: "pending",
        retryCount: { increment: 1 },
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
    });

    const schedulerConfig = await prisma.schedulerConfig.findFirst({
      where: { isActive: true },
    });
    const storagePath =
      process.env.RECORDINGS_PATH ||
      schedulerConfig?.storagePath ||
      "./recordings";
    const localDownloadService = new DownloadService(storagePath);

    const result = await localDownloadService.downloadRecording(
      log.cdrId,
      log.ruleId ?? undefined,
    );

    res.json({ success: result.success, error: result.error });
  } catch (error) {
    logger.error(`Retry download error: ${error}`);
    res.status(500).json({ error: "Retry failed" });
  }
});

export default router;
