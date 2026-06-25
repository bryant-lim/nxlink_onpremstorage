import { Router } from "express";
import {
  authenticate,
  authorize,
  loadPermissions,
  AuthRequest,
} from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req: AuthRequest, res) => {
  try {
    // Load permissions to check if user has agents:manage
    await loadPermissions(req, res, () => {});

    const { search, group, status } = req.query;

    const where: Record<string, unknown> = {};

    // If user doesn't have agents:manage, filter to their assigned agents
    if (!req.user?.permissions?.includes("agents:manage")) {
      const userAgents = await prisma.userAgent.findMany({
        where: { userId: BigInt(req.user!.userId) },
        include: { agent: true },
      });
      if (userAgents.length > 0) {
        where.name = { in: userAgents.map((ua) => ua.agent.name) };
      } else {
        // No assigned agents, return empty
        return res.json([]);
      }
    }

    // Apply filters
    if (search && typeof search === "string") {
      where.OR = [
        { name: { contains: search } },
        { nickname: { contains: search } },
      ];
    }
    if (group && typeof group === "string" && group !== "all") {
      where.group = group;
    }
    if (status && typeof status === "string" && status !== "all") {
      where.isActive = status === "active";
    }

    const agents = await prisma.agent.findMany({
      where,
      orderBy: [{ group: "asc" }, { name: "asc" }],
    });
    res.json(agents);
  } catch (error) {
    logger.error(`List agents error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/groups", async (_req, res) => {
  try {
    const groups = await prisma.agent.groupBy({
      by: ["group"],
      where: { group: { not: null } },
      _count: true,
      orderBy: { group: "asc" },
    });
    res.json(groups);
  } catch (error) {
    logger.error(`List agent groups error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const { name, nickname, group, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Agent name is required" });
      }

      const existing = await prisma.agent.findUnique({ where: { name } });
      if (existing) {
        return res.status(409).json({ error: "Agent name already exists" });
      }

      const agent = await prisma.agent.create({
        data: {
          name,
          nickname: nickname || null,
          group: group || null,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      logger.info(`Agent created: ${name} by ${req.user?.username}`);
      res.status(201).json(agent);
    } catch (error) {
      logger.error(`Create agent error: ${error}`);
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
      const { name, nickname, group, isActive } = req.body;

      const existing = await prisma.agent.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Agent not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) {
        const dup = await prisma.agent.findUnique({ where: { name } });
        if (dup && dup.id !== id) {
          return res.status(409).json({ error: "Agent name already exists" });
        }
        updateData.name = name;
      }
      if (nickname !== undefined) updateData.nickname = nickname || null;
      if (group !== undefined) updateData.group = group || null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.agent.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Agent updated: ${existing.name} by ${req.user?.username}`);
      res.json(updated);
    } catch (error) {
      logger.error(`Update agent error: ${error}`);
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

      const agent = await prisma.agent.findUnique({ where: { id } });
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      await prisma.agent.delete({ where: { id } });

      logger.info(`Agent deleted: ${agent.name} by ${req.user?.username}`);
      res.json({ message: "Agent deleted" });
    } catch (error) {
      logger.error(`Delete agent error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// CSV Import endpoint
router.post(
  "/import",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const { agents } = req.body;

      if (!Array.isArray(agents) || agents.length === 0) {
        return res.status(400).json({ error: "agents array is required" });
      }

      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < agents.length; i++) {
        const row = agents[i];
        const rowNum = i + 1;

        if (!row.name || typeof row.name !== "string" || !row.name.trim()) {
          results.errors.push(`Row ${rowNum}: Name is required`);
          results.skipped++;
          continue;
        }

        const name = row.name.trim();
        const nickname = row.nickname?.trim() || null;
        const group = row.group?.trim() || null;

        try {
          const existing = await prisma.agent.findUnique({ where: { name } });

          if (existing) {
            await prisma.agent.update({
              where: { name },
              data: {
                nickname: nickname !== undefined ? nickname : existing.nickname,
                group: group !== undefined ? group : existing.group,
              },
            });
            results.updated++;
          } else {
            await prisma.agent.create({
              data: {
                name,
                nickname,
                group,
                isActive: true,
              },
            });
            results.created++;
          }
        } catch (err: any) {
          results.errors.push(
            `Row ${rowNum}: ${err.message || "Failed to import"}`,
          );
          results.skipped++;
        }
      }

      logger.info(
        `CSV import: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped by ${req.user?.username}`,
      );
      res.json(results);
    } catch (error) {
      logger.error(`Agent import error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
