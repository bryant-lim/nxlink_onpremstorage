import { Router } from "express";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

const router = Router();

router.use(authenticate);

router.get("/", async (_req, res) => {
  try {
    const configs = await prisma.schedulerConfig.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(configs);
  } catch (error) {
    logger.error(`List scheduler configs error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const { cronExpression, lookbackHours, pageSize, storagePath, isActive } =
        req.body;

      if (!cronExpression || !storagePath) {
        return res
          .status(400)
          .json({ error: "cronExpression and storagePath are required" });
      }

      const config = await prisma.schedulerConfig.create({
        data: {
          cronExpression: cronExpression || "0 */6 * * *",
          lookbackHours: lookbackHours || 24,
          pageSize: pageSize || 100,
          storagePath,
          isActive: isActive !== undefined ? isActive : false,
        },
      });

      const { SchedulerService } = await import("./scheduler.service.js");
      await SchedulerService.getInstance().start().catch((err) =>
        logger.error(`Scheduler restart error: ${err}`)
      );

      logger.info(`Scheduler config created by ${req.user?.username}`);
      res.status(201).json(config);
    } catch (error) {
      logger.error(`Create scheduler config error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const { cronExpression, lookbackHours, pageSize, storagePath, isActive } =
        req.body;

      const existing = await prisma.schedulerConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Scheduler config not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (cronExpression !== undefined)
        updateData.cronExpression = cronExpression;
      if (lookbackHours !== undefined) updateData.lookbackHours = lookbackHours;
      if (pageSize !== undefined) updateData.pageSize = pageSize;
      if (storagePath !== undefined) updateData.storagePath = storagePath;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.schedulerConfig.update({
        where: { id },
        data: updateData,
      });

      const { SchedulerService } = await import("./scheduler.service.js");
      await SchedulerService.getInstance().start().catch((err) =>
        logger.error(`Scheduler restart error: ${err}`)
      );

      logger.info(`Scheduler config updated by ${req.user?.username}`);
      res.json(updated);
    } catch (error) {
      logger.error(`Update scheduler config error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );

      const config = await prisma.schedulerConfig.findUnique({ where: { id } });

      if (!config) {
        return res.status(404).json({ error: "Scheduler config not found" });
      }

      await prisma.schedulerConfig.delete({ where: { id } });

      const { SchedulerService } = await import("./scheduler.service.js");
      const schedulerInstance = SchedulerService.getInstance();
      const activeConfig = await prisma.schedulerConfig.findFirst({
        where: { isActive: true },
      });
      if (!activeConfig) {
        schedulerInstance.stop();
      } else {
        await schedulerInstance.start().catch((err) =>
          logger.error(`Scheduler restart error: ${err}`)
        );
      }

      logger.info(`Scheduler config deleted by ${req.user?.username}`);
      res.json({ message: "Scheduler config deleted" });
    } catch (error) {
      logger.error(`Delete scheduler config error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/run", authenticate, authorize("admin"), async (_req, res) => {
  try {
    const { SchedulerService } = await import("./scheduler.service.js");
    const scheduler = SchedulerService.getInstance();
    const result = await scheduler.runManual();
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error(`Manual scheduler run error: ${error}`);
    res
      .status(400)
      .json({ success: false, error: error.message || "Run failed" });
  }
});

export default router;
