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

// List all permissions
router.get("/permissions", async (_req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
    res.json(permissions);
  } catch (error) {
    logger.error(`List permissions error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all roles
router.get("/", async (_req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { permissions: true } },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    res.json(roles);
  } catch (error) {
    logger.error(`List roles error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single role with details
router.get("/:id", async (req, res) => {
  try {
    const id = BigInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    );
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    if (!role) return res.status(404).json({ error: "Role not found" });
    res.json(role);
  } catch (error) {
    logger.error(`Get role error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create role
router.post(
  "/",
  hasPermission("users:manage"),
  async (req: AuthRequest, res) => {
    try {
      const { name, description, permissionKeys } = req.body;

      if (!name)
        return res.status(400).json({ error: "Role name is required" });

      const existing = await prisma.role.findUnique({ where: { name } });
      if (existing)
        return res.status(409).json({ error: "Role name already exists" });

      const role = await prisma.role.create({
        data: { name, description: description || null },
      });

      if (permissionKeys && Array.isArray(permissionKeys)) {
        const perms = await prisma.permission.findMany({
          where: { key: { in: permissionKeys } },
        });
        for (const perm of perms) {
          await prisma.rolePermission.create({
            data: { roleId: Number(role.id), permissionId: Number(perm.id) },
          });
        }
      }

      logger.info(`Role created: ${name} by ${req.user?.username}`);
      res.status(201).json(role);
    } catch (error) {
      logger.error(`Create role error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Update role
router.patch(
  "/:id",
  hasPermission("users:manage"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );
      const { name, description, permissionKeys } = req.body;

      const existing = await prisma.role.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Role not found" });
      if (existing.isSystem)
        return res
          .status(400)
          .json({ error: "Built-in roles cannot be modified" });

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) {
        const dup = await prisma.role.findUnique({ where: { name } });
        if (dup && dup.id !== id)
          return res.status(409).json({ error: "Role name already exists" });
        updateData.name = name;
      }
      if (description !== undefined)
        updateData.description = description || null;

      const updated = await prisma.role.update({
        where: { id },
        data: updateData,
      });

      if (permissionKeys && Array.isArray(permissionKeys)) {
        await prisma.rolePermission.deleteMany({
          where: { roleId: Number(id) },
        });
        const perms = await prisma.permission.findMany({
          where: { key: { in: permissionKeys } },
        });
        for (const perm of perms) {
          await prisma.rolePermission.create({
            data: { roleId: Number(id), permissionId: Number(perm.id) },
          });
        }
      }

      logger.info(`Role updated: ${existing.name} by ${req.user?.username}`);
      res.json(updated);
    } catch (error) {
      logger.error(`Update role error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Delete role
router.delete(
  "/:id",
  hasPermission("users:manage"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );

      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) return res.status(404).json({ error: "Role not found" });
      if (role.isSystem)
        return res
          .status(400)
          .json({ error: "Built-in roles cannot be deleted" });

      await prisma.role.delete({ where: { id } });
      logger.info(`Role deleted: ${role.name} by ${req.user?.username}`);
      res.json({ message: "Role deleted" });
    } catch (error) {
      logger.error(`Delete role error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
