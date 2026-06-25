import { Router } from "express";
import { authenticate, authorize, AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { NxlinkApiService } from "../../services/nxlink-api.service.js";
import { isEncryptionEnabled } from "../../utils/crypto.js";

const router = Router();

router.use(authenticate);

router.get("/", async (_req, res) => {
  try {
    const configs = await prisma.apiConfig.findMany({
      select: {
        id: true,
        name: true,
        region: true,
        apiGateway: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(configs);
  } catch (error) {
    logger.error(`List API configs error: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const {
        name,
        region,
        apiGateway,
        accessKey,
        accessSecret,
        bizType,
        action,
      } = req.body;

      if (!name || !region || !apiGateway || !accessKey || !accessSecret) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const config = await prisma.apiConfig.create({
        data: {
          name,
          region,
          apiGateway,
          accessKey,
          secretKey: accessSecret,
          bizType: bizType || "8",
          action: action || "cc",
        },
        select: {
          id: true,
          name: true,
          region: true,
          apiGateway: true,
          isActive: true,
          createdAt: true,
        },
      });

      logger.info(`API config created: ${name} by ${req.user?.username}`);

      res.status(201).json(config);
    } catch (error) {
      logger.error(`Create API config error: ${error}`);
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
      const { name, region, apiGateway, accessKey, accessSecret, isActive } =
        req.body;

      const existing = await prisma.apiConfig.findUnique({ where: { id } });

      if (!existing) {
        return res.status(404).json({ error: "API config not found" });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (region !== undefined) updateData.region = region;
      if (apiGateway !== undefined) updateData.apiGateway = apiGateway;
      if (accessKey !== undefined) updateData.accessKey = accessKey;
      if (accessSecret !== undefined) updateData.secretKey = accessSecret;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.apiConfig.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          region: true,
          apiGateway: true,
          isActive: true,
          updatedAt: true,
        },
      });

      logger.info(
        `API config updated: ${existing.name} by ${req.user?.username}`,
      );

      res.json(updated);
    } catch (error) {
      logger.error(`Update API config error: ${error}`);
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

      const config = await prisma.apiConfig.findUnique({ where: { id } });

      if (!config) {
        return res.status(404).json({ error: "API config not found" });
      }

      await prisma.apiConfig.delete({ where: { id } });

      logger.info(
        `API config deleted: ${config.name} by ${req.user?.username}`,
      );

      res.json({ message: "API config deleted" });
    } catch (error) {
      logger.error(`Delete API config error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/:id/test",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const id = BigInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      );

      const config = await prisma.apiConfig.findUnique({ where: { id } });

      if (!config) {
        return res.status(404).json({ error: "API config not found" });
      }

      const service = new NxlinkApiService({
        apiGateway: config.apiGateway,
        accessKey: config.accessKey,
        accessSecret: config.secretKey,
        bizType: config.bizType,
        action: config.action,
      });

      const result = await service.testConnection();

      res.json(result);
    } catch (error: any) {
      logger.error(`Test API connection error: ${error}`);
      res
        .status(500)
        .json({ success: false, message: error.message || "Test failed" });
    }
  },
);

router.get("/status", authenticate, async (_req, res) => {
  try {
    const activeConfig = await prisma.apiConfig.findFirst({
      where: { isActive: true },
    });

    if (!activeConfig) {
      return res.json({
        connected: false,
        lastChecked: new Date().toISOString(),
        error: "No active API configuration",
        configName: null,
      });
    }

    const service = new NxlinkApiService({
      apiGateway: activeConfig.apiGateway,
      accessKey: activeConfig.accessKey,
      accessSecret: activeConfig.secretKey,
      bizType: activeConfig.bizType,
      action: activeConfig.action,
    });

    const result = await service.testConnection();

    res.json({
      connected: result.success,
      lastChecked: new Date().toISOString(),
      error: result.success ? null : result.message,
      configName: activeConfig.name,
      details: result.details || null,
    });
  } catch (error: any) {
    logger.error(`Connection status check error: ${error}`);
    res.json({
      connected: false,
      lastChecked: new Date().toISOString(),
      error: error.message || "Status check failed",
      configName: null,
    });
  }
});

export let connectionStatus: {
  connected: boolean;
  lastChecked: string;
  error: string | null;
  configName: string | null;
} = {
  connected: false,
  lastChecked: new Date().toISOString(),
  error: "Not checked yet",
  configName: null,
};

export async function checkConnection(): Promise<void> {
  try {
    const activeConfig = await prisma.apiConfig.findFirst({
      where: { isActive: true },
    });

    if (!activeConfig) {
      connectionStatus = {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: "No active API configuration",
        configName: null,
      };
      return;
    }

    const service = new NxlinkApiService({
      apiGateway: activeConfig.apiGateway,
      accessKey: activeConfig.accessKey,
      accessSecret: activeConfig.secretKey,
      bizType: activeConfig.bizType,
      action: activeConfig.action,
    });

    const result = await service.testConnection();

    connectionStatus = {
      connected: result.success,
      lastChecked: new Date().toISOString(),
      error: result.success ? null : result.message,
      configName: activeConfig.name,
    };
  } catch (error: any) {
    connectionStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: error.message || "Status check failed",
      configName: null,
    };
  }
}

// Encryption status endpoint
router.get("/encryption-status", authenticate, (_req, res) => {
  res.json({
    enabled: isEncryptionEnabled(),
  });
});

export default router;
