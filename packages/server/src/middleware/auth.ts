import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt.js";
import { prisma } from "../config/database.js";

export interface AuthRequest extends Request {
  user?: JwtPayload & { permissions?: string[] };
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const token = header.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function loadPermissions(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next();

  try {
    const userId = BigInt(req.user.userId);
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissionKeys = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        permissionKeys.add(rp.permission.key);
      }
    }

    req.user.permissions = Array.from(permissionKeys);
    next();
  } catch {
    req.user!.permissions = [];
    next();
  }
}

export function hasPermission(...requiredPermissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!req.user.permissions) {
      await loadPermissions(req, res, () => {});
    }

    const hasAll = requiredPermissions.every((p) =>
      req.user!.permissions?.includes(p),
    );

    if (!hasAll) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

export function authorize(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = BigInt(req.user.userId);
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });

      const userRoleNames = userRoles.map((ur) => ur.role.name);
      const hasAny = roles.some((r) => userRoleNames.includes(r));

      if (!hasAny) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      next();
    } catch {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
  };
}

export async function getUserAgentAccess(userId: number): Promise<string[]> {
  const userAgents = await prisma.userAgent.findMany({
    where: { userId: BigInt(userId) },
    include: { agent: true },
  });

  return userAgents.map((ua) => ua.agent.name);
}
