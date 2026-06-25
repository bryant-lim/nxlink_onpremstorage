import { prisma } from "../config/database.js";

interface AuditLogInput {
  userId?: number;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ? BigInt(input.userId) : null,
        action: input.action,
        entityType: input.entityType || null,
        entityId: input.entityId ? BigInt(input.entityId) : null,
        details: (input.details ? JSON.stringify(input.details) : null) as any,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });
  } catch (error) {
    // Fail silently - audit logging should not break the main flow
    console.error("Audit log error:", error);
  }
}
