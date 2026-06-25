import axios from "axios";
import fs from "fs";
import path from "path";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { isEncryptionEnabled, encrypt, decrypt } from "../../utils/crypto.js";

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

export class DownloadService {
  private storageRoot: string;

  constructor(storageRoot: string) {
    this.storageRoot = storageRoot;
  }

  getRecordingPath(cdr: {
    callId: string;
    agentName: string | null;
    startTime: bigint | null;
  }): string {
    const date = cdr.startTime ? new Date(Number(cdr.startTime)) : new Date();
    const year = date.getFullYear();
    const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const agentName = cdr.agentName || "unknown";
    const ext = isEncryptionEnabled() ? "mp3.enc" : "mp3";

    return path.join(
      this.storageRoot,
      String(year),
      monthDay,
      agentName,
      `${cdr.callId}.${ext}`,
    );
  }

  async download(url: string, filePath: string): Promise<DownloadResult> {
    try {
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(filePath)) {
        return {
          success: true,
          filePath,
          fileSize: fs.statSync(filePath).size,
        };
      }

      const response = await axios({
        url,
        method: "GET",
        responseType: "arraybuffer",
        timeout: 60000,
      });

      let data = Buffer.from(response.data);

      // Encrypt if encryption is enabled
      if (isEncryptionEnabled()) {
        data = encrypt(data);
      }

      fs.writeFileSync(filePath, data);

      return {
        success: true,
        filePath,
        fileSize: data.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Download failed",
      };
    }
  }

  async downloadRecording(
    cdrId: bigint,
    ruleId?: bigint,
  ): Promise<DownloadResult> {
    const cdr = await prisma.cdrRecord.findUnique({ where: { id: cdrId } });

    if (!cdr) {
      return { success: false, error: "CDR record not found" };
    }

    if (!cdr.recordUrl) {
      return { success: false, error: "No recording URL available" };
    }

    const logEntry = await prisma.downloadLog.create({
      data: {
        cdrId,
        ruleId: ruleId || null,
        status: "downloading",
        triggeredBy: "scheduler",
      },
    });

    const filePath = this.getRecordingPath({
      callId: cdr.callId,
      agentName: cdr.agentName,
      startTime: cdr.startTime,
    });

    await prisma.downloadLog.update({
      where: { id: logEntry.id },
      data: { startedAt: new Date(), filePath },
    });

    const result = await this.download(cdr.recordUrl, filePath);

    if (result.success) {
      await prisma.downloadLog.update({
        where: { id: logEntry.id },
        data: {
          status: "success",
          filePath: result.filePath,
          fileSize: result.fileSize ? BigInt(result.fileSize) : null,
          completedAt: new Date(),
        },
      });

      logger.info(`Download success: ${cdr.callId} -> ${result.filePath}`);
    } else {
      await prisma.downloadLog.update({
        where: { id: logEntry.id },
        data: {
          status: "failed",
          errorMessage: result.error,
          completedAt: new Date(),
        },
      });

      logger.error(`Download failed: ${cdr.callId} - ${result.error}`);
    }

    return result;
  }

  async getRecordingStream(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    return fs.createReadStream(filePath);
  }
}
