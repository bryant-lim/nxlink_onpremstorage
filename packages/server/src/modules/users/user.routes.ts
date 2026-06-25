import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../config/database.js";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";

const router = Router();

const SALT_ROUNDS = 12;

router.use(authenticate, authorize("admin"));

router.get("/", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (error) {
    logger.error(`List users error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const id = BigInt(req.params.id as string);
    const { email, role, isActive, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (Number(user.id) === req.user?.userId && isActive === false) {
      return res.status(400).json({ error: "Cannot deactivate yourself" });
    }

    const updateData: Record<string, unknown> = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) {
      const validRoles = ["admin", "manager", "viewer"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    logger.info(`User ${user.username} updated by ${req.user?.username}`);

    res.json(updated);
  } catch (error) {
    logger.error(`Update user error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = BigInt(req.params.id as string);

    if (Number(id) === req.user?.userId) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id } });

    logger.info(`User ${user.username} deleted by ${req.user?.username}`);

    res.json({ message: "User deleted" });
  } catch (error) {
    logger.error(`Delete user error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/password", async (req: AuthRequest, res) => {
  try {
    const id = BigInt(req.params.id as string);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    logger.info(
      `Password changed for user ${user.username} by ${req.user?.username}`,
    );
    res.json({ message: "Password updated" });
  } catch (error) {
    logger.error(`Change password error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
