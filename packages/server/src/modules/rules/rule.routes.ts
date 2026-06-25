import { Router } from "express";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

const router = Router();

router.use(authenticate);

router.get("/", async (_req, res) => {
  try {
    const rules = await prisma.downloadRule.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(rules);
  } catch (error) {
    logger.error(`List rules error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/",
  authenticate,
  authorize("admin", "manager"),
  async (req: AuthRequest, res) => {
    try {
      const {
        name,
        agentNames,
        directions,
        answeredOnly,
        minDuration,
        isActive,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Rule name is required" });
      }

      const rule = await prisma.downloadRule.create({
        data: {
          name,
          agentNames: agentNames ? JSON.stringify(agentNames) : undefined,
          directions: directions ? JSON.stringify(directions) : undefined,
          answeredOnly: answeredOnly || false,
          minDuration: minDuration || null,
          isActive: isActive !== undefined ? isActive : true,
          createdById: req.user?.userId ? BigInt(req.user.userId) : null,
        },
      });

      logger.info(`Download rule created: ${name} by ${req.user?.username}`);

      res.status(201).json(rule);
    } catch (error) {
      logger.error(`Create rule error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.patch(
  "/:id",
  authenticate,
  authorize("admin", "manager"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const {
        name,
        agentNames,
        directions,
        answeredOnly,
        minDuration,
        isActive,
      } = req.body;

      const existing = await prisma.downloadRule.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: "Rule not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (agentNames !== undefined)
        updateData.agentNames = JSON.stringify(agentNames);
      if (directions !== undefined)
        updateData.directions = JSON.stringify(directions);
      if (answeredOnly !== undefined) updateData.answeredOnly = answeredOnly;
      if (minDuration !== undefined) updateData.minDuration = minDuration;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.downloadRule.update({
        where: { id },
        data: updateData,
      });

      logger.info(
        `Download rule updated: ${existing.name} by ${req.user?.username}`,
      );

      res.json(updated);
    } catch (error) {
      logger.error(`Update rule error: ${error}`);
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

      const rule = await prisma.downloadRule.findUnique({ where: { id } });

      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      await prisma.downloadRule.delete({ where: { id } });

      logger.info(
        `Download rule deleted: ${rule.name} by ${req.user?.username}`,
      );

      res.json({ message: "Rule deleted" });
    } catch (error) {
      logger.error(`Delete rule error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
