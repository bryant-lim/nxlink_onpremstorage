import { Router } from "express";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

const router = Router();

router.use(authenticate);

router.get("/audit-trail", async (req: AuthRequest, res) => {
  try {
    const {
      page = "1",
      size = "20",
      action,
      userId,
      entityType,
      startDate,
      endDate,
    } = req.query;

    const where: Record<string, unknown> = {};

    if (action) where.action = action;
    if (userId) where.userId = BigInt(userId as string);
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate)
        (where.createdAt as any).gte = new Date(startDate as string);
      if (endDate) (where.createdAt as any).lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, username: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(size),
        take: Number(size),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page: Number(page),
      size: Number(size),
      totalPages: Math.ceil(total / Number(size)),
    });
  } catch (error) {
    logger.error(`Audit trail error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/playback-history", async (req: AuthRequest, res) => {
  try {
    const { page = "1", size = "20", userId, startDate, endDate } = req.query;

    const where: Record<string, unknown> = {};

    if (userId) where.userId = BigInt(userId as string);
    if (startDate || endDate) {
      where.playedAt = {};
      if (startDate)
        (where.playedAt as any).gte = new Date(startDate as string);
      if (endDate) (where.playedAt as any).lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.playbackLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, role: true } },
          cdr: {
            select: {
              id: true,
              callId: true,
              agentName: true,
              caller: true,
              callee: true,
            },
          },
        },
        orderBy: { playedAt: "desc" },
        skip: (Number(page) - 1) * Number(size),
        take: Number(size),
      }),
      prisma.playbackLog.count({ where }),
    ]);

    res.json({
      data: logs,
      total,
      page: Number(page),
      size: Number(size),
      totalPages: Math.ceil(total / Number(size)),
    });
  } catch (error) {
    logger.error(`Playback history error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/call-stats", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.startTime = {};
      const now = Math.floor(Date.now() / 1000);
      if (startDate) {
        (where.startTime as any).gte = BigInt(
          Math.floor(new Date(startDate as string).getTime() / 1000),
        );
      }
      if (endDate) {
        (where.startTime as any).lte = BigInt(
          Math.floor(new Date(endDate as string).getTime() / 1000),
        );
      }
    }

    const [totalCalls, answeredCalls, byDirection, byAgent] = await Promise.all(
      [
        prisma.cdrRecord.count({ where }),
        prisma.cdrRecord.count({ where: { ...where, answered: true } }),
        prisma.cdrRecord.groupBy({
          by: ["direction"],
          where,
          _count: true,
        }),
        prisma.cdrRecord.groupBy({
          by: ["agentName"],
          where: { ...where, agentName: { not: null } },
          _count: true,
          _avg: { callDuration: true },
          orderBy: { _count: { agentName: "desc" } },
          take: 20,
        }),
      ],
    );

    res.json({
      summary: {
        totalCalls,
        answeredCalls,
        unansweredCalls: totalCalls - answeredCalls,
        answerRate:
          totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : 0,
      },
      byDirection: byDirection.map((d) => ({
        direction: d.direction,
        label: ["Inbound", "Outbound", "AICC"][d.direction || 0],
        count: d._count,
      })),
      byAgent: byAgent
        .filter((a) => a.agentName)
        .map((a) => ({
          agentName: a.agentName,
          count: a._count,
          avgDuration: a._avg.callDuration
            ? Math.round(Number(a._avg.callDuration))
            : 0,
        })),
    });
  } catch (error) {
    logger.error(`Call stats error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/download-summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Count unique CDRs with successful downloads (not log entries)
    const successLogs = await prisma.downloadLog.findMany({
      where: {
        status: "success",
        filePath: { not: null },
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate as string) } : {}),
                ...(endDate ? { lte: new Date(endDate as string) } : {}),
              },
            }
          : {}),
      },
      select: { cdrId: true, fileSize: true },
    });

    // Deduplicate by cdrId — only count the latest successful download per CDR
    const uniqueMap = new Map<bigint, number>();
    for (const log of successLogs) {
      uniqueMap.set(log.cdrId, Number(log.fileSize || 0));
    }

    const uniqueSuccessCount = uniqueMap.size;
    const totalSize = Array.from(uniqueMap.values()).reduce((a, b) => a + b, 0);

    // Count failed and skipped (unique by cdrId too)
    const failedLogs = await prisma.downloadLog.findMany({
      where: { status: "failed" },
      select: { cdrId: true },
    });
    const skippedLogs = await prisma.downloadLog.findMany({
      where: { status: "skipped" },
      select: { cdrId: true },
    });

    const uniqueFailed = new Set(failedLogs.map((l) => l.cdrId.toString()))
      .size;
    const uniqueSkipped = new Set(skippedLogs.map((l) => l.cdrId.toString()))
      .size;

    const dailyLogs = await prisma.dailyLog.findMany({
      orderBy: { logDate: "desc" },
      take: 30,
    });

    res.json({
      summary: {
        total: uniqueSuccessCount + uniqueFailed + uniqueSkipped,
        success: uniqueSuccessCount,
        failed: uniqueFailed,
        skipped: uniqueSkipped,
        totalSizeBytes: totalSize,
      },
      byStatus: [
        { status: "success", count: uniqueSuccessCount },
        { status: "failed", count: uniqueFailed },
        { status: "skipped", count: uniqueSkipped },
      ],
      dailyLogs,
    });
  } catch (error) {
    logger.error(`Download summary error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
