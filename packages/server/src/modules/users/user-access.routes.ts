import { Router } from "express";
import {
  authenticate,
  hasPermission,
  AuthRequest,
} from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";

const router = Router();

router.use(authenticate);

// Get user's roles and agent access
// Any authenticated user can read their own access data
router.get("/:id/access", async (req: AuthRequest, res) => {
  try {
    const id = BigInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    );

    logger.info(
      `[DEBUG] GET /users/:id/access - req.user=${JSON.stringify(req.user)}, id=${id}`,
    );

    // Users can only access their own data (unless they have users:manage)
    if (req.user && BigInt(req.user.userId) !== id) {
      // For cross-user access, we'd need to check permissions, but for now
      // just allow admins to access any user's data
      if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const roles = await prisma.userRole.findMany({
      where: { userId: id },
      include: { role: true },
    });

    const agents = await prisma.userAgent.findMany({
      where: { userId: id },
      include: { agent: true },
    });

    res.json({
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        isActive: user.isActive,
      },
      roles: roles.map((r) => ({
        id: Number(r.role.id),
        name: r.role.name,
        description: r.role.description,
      })),
      agents: agents.map((a) => ({
        id: Number(a.agent.id),
        name: a.agent.name,
        nickname: a.agent.nickname,
        group: a.agent.group,
      })),
    });
  } catch (error) {
    logger.error(`Get user access error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign roles to user
router.patch(
  "/:id/roles",
  hasPermission("users:manage"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const { roleIds } = req.body;

      if (!Array.isArray(roleIds))
        return res.status(400).json({ error: "roleIds array is required" });

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: "User not found" });

      await prisma.userRole.deleteMany({ where: { userId: id } });

      for (const roleId of roleIds) {
        await prisma.userRole.create({
          data: { userId: id, roleId: BigInt(roleId) },
        });
      }

      logger.info(
        `Roles updated for user ${user.username} by ${req.user?.username}`,
      );
      res.json({ message: "Roles updated" });
    } catch (error) {
      logger.error(`Update user roles error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Assign agents to user
router.patch(
  "/:id/agents",
  hasPermission("users:manage"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const { agentIds } = req.body;

      if (!Array.isArray(agentIds))
        return res.status(400).json({ error: "agentIds array is required" });

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: "User not found" });

      await prisma.userAgent.deleteMany({ where: { userId: id } });

      for (const agentId of agentIds) {
        await prisma.userAgent.create({
          data: { userId: id, agentId: BigInt(agentId) },
        });
      }

      logger.info(
        `Agents updated for user ${user.username} by ${req.user?.username}`,
      );
      res.json({ message: "Agents updated" });
    } catch (error) {
      logger.error(`Update user agents error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// User preferences (any authenticated user can manage their own)
router.get("/me/preferences", async (req: AuthRequest, res) => {
  try {
    const prefs = await prisma.userPreference.findUnique({
      where: { userId: BigInt(req.user!.userId) },
    });

    if (!prefs) {
      return res.json({
        visibleColumns: [
          "agentName",
          "caller",
          "callee",
          "direction",
          "answered",
          "callDuration",
          "callStatus",
          "startTime",
          "actions",
        ],
        columnOrder: null,
        pageSize: 20,
      });
    }

    res.json({
      visibleColumns: JSON.parse(prefs.visibleColumns as string),
      columnOrder: prefs.columnOrder
        ? JSON.parse(prefs.columnOrder as string)
        : null,
      pageSize: prefs.pageSize,
    });
  } catch (error) {
    logger.error(`Get preferences error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/me/preferences", async (req: AuthRequest, res) => {
  try {
    const { visibleColumns, columnOrder, pageSize } = req.body;
    const userId = BigInt(req.user!.userId);

    const prefs = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        visibleColumns: JSON.stringify(visibleColumns),
        columnOrder: (columnOrder ? JSON.stringify(columnOrder) : null) as any,
        pageSize: pageSize || 20,
      },
      create: {
        userId,
        visibleColumns: JSON.stringify(visibleColumns),
        columnOrder: (columnOrder ? JSON.stringify(columnOrder) : null) as any,
        pageSize: pageSize || 20,
      },
    });

    res.json({
      visibleColumns: JSON.parse(prefs.visibleColumns as string),
      columnOrder: prefs.columnOrder
        ? JSON.parse(prefs.columnOrder as string)
        : null,
      pageSize: prefs.pageSize,
    });
  } catch (error) {
    logger.error(`Save preferences error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
