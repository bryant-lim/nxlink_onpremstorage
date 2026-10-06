import { Router } from "express";
import fs from "fs";
import path from "path";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { verifyToken, JwtPayload } from "../../utils/jwt.js";
import { logger } from "../../utils/logger.js";
import { prisma } from "../../config/database.js";
import { isEncryptionEnabled, decrypt } from "../../utils/crypto.js";

const router = Router();

// Custom auth for audio stream that supports token via query param
// (audio elements can't send Authorization headers)
function streamAuth(req: AuthRequest, res: any, next: any) {
  const token =
    (req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null) ||
    (req.query.token && typeof req.query.token === "string"
      ? req.query.token
      : null);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

router.use(streamAuth);

router.get("/stream", async (req: AuthRequest, res) => {
  try {
    const { filePath, callId, cdrId } = req.query;

    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({ error: "filePath is required" });
    }

    const schedulerConfig = await prisma.schedulerConfig.findFirst({
      where: { isActive: true },
    });
    const configPath =
      process.env.RECORDINGS_PATH ||
      schedulerConfig?.storagePath ||
      "./recordings";
    const recordingsPath = path.resolve(configPath);

    let streamPath = path.resolve(filePath);

    // Fallback: if file is not found at stored path, check under recordingsPath
    if (!fs.existsSync(streamPath)) {
      const match = filePath.match(/recordings[/\\](.+)$/);
      if (match) {
        const altPath = path.join(recordingsPath, match[1]);
        if (fs.existsSync(altPath)) {
          streamPath = altPath;
        }
      }
    }

    const allowedRoots = [
      recordingsPath,
      path.resolve("/app/recordings"),
      path.resolve("/app/packages/server/recordings"),
      path.resolve("./recordings"),
    ];

    const isAllowed = allowedRoots.some((root) => streamPath.startsWith(root));
    if (!isAllowed) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(streamPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Check if file is encrypted (by extension or by checking if encryption is enabled)
    const isEncrypted =
      streamPath.endsWith(".enc") ||
      (isEncryptionEnabled() && !streamPath.endsWith(".mp3"));

    if (isEncrypted) {
      // Decrypt entire file and stream
      try {
        const encryptedData = fs.readFileSync(streamPath);
        const decryptedData = decrypt(encryptedData);

        res.writeHead(200, {
          "Content-Length": decryptedData.length,
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
        });

        res.end(decryptedData);
      } catch (decryptError: any) {
        logger.error(`Decryption failed: ${decryptError.message}`);
        return res
          .status(500)
          .json({
            error:
              "Failed to decrypt audio file. Encryption key may have changed.",
          });
      }
    } else {
      // Stream unencrypted file with range support
      const stat = fs.statSync(streamPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "audio/mpeg",
        });

        fs.createReadStream(streamPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "audio/mpeg",
        });

        fs.createReadStream(streamPath).pipe(res);
      }
    }

    if (req.user) {
      await prisma.playbackLog.create({
        data: {
          userId: BigInt(req.user.userId),
          cdrId: cdrId ? BigInt(cdrId as string) : null,
          callId: typeof callId === "string" ? callId : null,
        },
      });
    }
  } catch (error) {
    logger.error(`Audio stream error: ${error}`);
    res.status(500).json({ error: "Streaming failed" });
  }
});

export default router;
