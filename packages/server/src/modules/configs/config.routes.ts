import axios from "axios";
import crypto from "crypto";
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
        accessKey: true,
        secretKey: true,
        aiTokenUrl: true,
        aiAppUrl: true,
        platToken: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = configs.map((c) => ({
      ...c,
      accessSecret: c.secretKey,
    }));

    res.json(mapped);
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
        aiTokenUrl,
        aiAppUrl,
        platToken,
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
          aiTokenUrl: aiTokenUrl || null,
          aiAppUrl: aiAppUrl || "https://app.nxlink.ai",
          platToken: platToken || null,
        },
        select: {
          id: true,
          name: true,
          region: true,
          apiGateway: true,
          aiTokenUrl: true,
          aiAppUrl: true,
          platToken: true,
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
      const {
        name,
        region,
        apiGateway,
        accessKey,
        accessSecret,
        aiTokenUrl,
        aiAppUrl,
        platToken,
        isActive,
      } = req.body;

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
      if (aiTokenUrl !== undefined) updateData.aiTokenUrl = aiTokenUrl;
      if (aiAppUrl !== undefined) updateData.aiAppUrl = aiAppUrl;
      if (platToken !== undefined) updateData.platToken = platToken;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await prisma.apiConfig.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          region: true,
          apiGateway: true,
          aiTokenUrl: true,
          aiAppUrl: true,
          platToken: true,
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

// Fetch NXLink login captcha
router.get(
  "/ai-token-captcha",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const host = (
        (req.query.host as string) || "https://app.nxlink.ai"
      ).replace(/\/+$/, "");
      const captchaUrl = `${host}/admin/saas_plat/captcha/start_image_verify`;
      const response = await axios.get(captchaUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Origin: host,
          Referer: `${host}/admin/`,
        },
        timeout: 10000,
      });

      const data = response.data;
      if (data && data.code === 0 && data.data) {
        return res.json({
          success: true,
          key: data.data.key,
          image: data.data.image,
        });
      }

      return res
        .status(400)
        .json({ error: "Failed to retrieve captcha from NXLink" });
    } catch (error: any) {
      logger.error(`Fetch AI token captcha error: ${error.message || error}`);
      return res
        .status(500)
        .json({ error: "Failed to connect to NXLink captcha service" });
    }
  },
);

// Generate AI plat_token using NXLink Admin credentials
router.post(
  "/generate-ai-token",
  authenticate,
  authorize("admin"),
  async (req: AuthRequest, res) => {
    try {
      const { email, password, captchaCode, captchaKey, host } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email/Account and Password are required" });
      }

      if (!captchaCode || !captchaKey) {
        return res
          .status(400)
          .json({ error: "Image verification code is required" });
      }

      const targetHost = (host || "https://app.nxlink.ai").replace(/\/+$/, "");
      const loginUrl = `${targetHost}/admin/saas_plat/user/login`;
      const deviceUuid = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2);

      const response = await axios.put(
        loginUrl,
        {
          email,
          password,
          loginMethod: 0,
          graphVerificationCode: captchaCode,
          key: captchaKey,
          deviceType: "Browser",
          deviceUniqueIdentification: deviceUuid,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Origin: targetHost,
            Referer: `${targetHost}/admin/`,
          },
          timeout: 15000,
        },
      );

      const data = response.data;
      if (data && data.code === 0 && data.data?.token) {
        logger.info(
          `Successfully generated AI plat_token for user: ${email} via ${targetHost}`,
        );
        return res.json({
          success: true,
          token: data.data.token,
          tenantHost: targetHost,
        });
      }

      const errorMsg =
        data?.message ||
        data?.msg ||
        `Login failed (NXLink response code: ${data?.code ?? "unknown"})`;
      logger.warn(`Failed to generate plat_token: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    } catch (error: any) {
      logger.error(`Generate AI token error: ${error.message || error}`);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.msg ||
        error.message ||
        "Failed to authenticate with NXLink";
      return res.status(500).json({ error: msg });
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
