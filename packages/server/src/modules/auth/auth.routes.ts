import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../config/database.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  JwtPayload,
} from "../../utils/jwt.js";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { logAudit } from "../../utils/audit.js";

const router = Router();

const SALT_ROUNDS = 12;

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload: JwtPayload = {
      userId: Number(user.id),
      username: user.username,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    logger.info(`User logged in: ${username}`);

    logAudit({
      userId: Number(user.id),
      action: "login",
      entityType: "user",
      entityId: Number(user.id),
      ipAddress: req.ip || undefined,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error(`Login error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/register",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role !== "admin") {
        return res
          .status(403)
          .json({ error: "Only admins can register users" });
      }

      const { username, password, email, role } = req.body;

      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username and password are required" });
      }

      // Validate role against database
      const validRole = await prisma.role.findUnique({ where: { name: role } });
      if (!validRole) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const userRole = role || "viewer";

      const existing = await prisma.user.findUnique({ where: { username } });

      if (existing) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          email: email || null,
          role: userRole,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      logger.info(`User registered: ${username} by ${req.user.username}`);

      res.status(201).json({
        id: Number(user.id),
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error) {
      logger.error(`Register error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const payload = verifyToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: BigInt(payload.userId) },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const newPayload: JwtPayload = {
      userId: Number(user.id),
      username: user.username,
      role: user.role,
    };

    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(req.user!.userId) },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: Number(user.id),
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (error) {
    logger.error(`Get me error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
