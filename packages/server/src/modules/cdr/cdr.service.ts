import { prisma } from "../../config/database.js";
import { NxlinkApiService } from "../../services/nxlink-api.service.js";
import { NxlinkCdrResponse } from "@nxlink-vr/shared";
import { logger } from "../../utils/logger.js";

export interface CdrSyncResult {
  synced: number;
  updated: number;
  total: number;
}

export class CdrService {
  async syncFromApi(
    apiService: NxlinkApiService,
    startTime: number,
    endTime: number,
  ): Promise<CdrSyncResult> {
    logger.info(`Starting CDR sync: ${startTime} - ${endTime}`);

    const records = await apiService.fetchAllCdrs({
      startTime,
      endTime,
      size: 100,
    });

    let synced = 0;
    let updated = 0;

    for (const record of records) {
      const existing = await prisma.cdrRecord.findUnique({
        where: { callId: record.callId },
      });

      const data = this.mapToCdrData(record);

      if (existing) {
        await prisma.cdrRecord.update({
          where: { callId: record.callId },
          data,
        });
        updated++;
      } else {
        await prisma.cdrRecord.create({ data });
        synced++;
      }
    }

    logger.info(
      `CDR sync complete: ${synced} new, ${updated} updated, ${records.length} total`,
    );

    return { synced, updated, total: records.length };
  }

  async query(params: {
    answered?: number;
    direction?: number;
    name?: string;
    names?: string[];
    caller?: string;
    callee?: string;
    callId?: string;
    orderId?: string;
    startTime?: number;
    endTime?: number;
    minDuration?: number;
    page: number;
    size: number;
    userId?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (params.answered !== undefined) {
      where.answered =
        params.answered === 0
          ? undefined
          : params.answered === 1
            ? false
            : true;
    }
    if (params.direction !== undefined && params.direction !== 0) {
      where.direction = params.direction;
    }

    // Agent access filter
    if (params.userId !== undefined) {
      const userAgents = await prisma.userAgent.findMany({
        where: { userId: BigInt(params.userId) },
        include: { agent: true },
      });

      if (userAgents.length > 0) {
        const allowedAgentNames = userAgents.map((ua) => ua.agent.name);
        // Combine with any additional name filters
        const names =
          params.names && params.names.length > 0
            ? params.names.filter((n) => allowedAgentNames.includes(n))
            : allowedAgentNames;
        where.agentName = names.length > 0 ? { in: names } : "";
      } else if (params.names && params.names.length > 0) {
        where.agentName = { in: params.names };
      } else if (params.name) {
        where.agentName = { contains: params.name };
      }
    } else if (params.names && params.names.length > 0) {
      where.agentName = { in: params.names };
    } else if (params.name) {
      where.agentName = { contains: params.name };
    }
    if (params.caller) {
      where.caller = { contains: params.caller };
    }
    if (params.callee) {
      where.callee = { contains: params.callee };
    }
    if (params.callId) {
      where.callId = { contains: params.callId };
    }
    if (params.orderId) {
      where.orderId = { contains: params.orderId };
    }
    if (params.startTime !== undefined) {
      where.startTime = { gte: BigInt(params.startTime * 1000) };
    }
    if (params.endTime !== undefined) {
      where.endTime = { lte: BigInt(params.endTime * 1000) };
    }
    if (params.minDuration !== undefined) {
      where.callDuration = { gte: params.minDuration };
    }

    const [records, total] = await Promise.all([
      prisma.cdrRecord.findMany({
        where,
        orderBy: { startTime: "desc" },
        skip: (params.page - 1) * params.size,
        take: params.size,
        include: {
          downloadLogs: {
            where: { status: "success", filePath: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.cdrRecord.count({ where }),
    ]);

    const dataWithLocalPath = records.map((record) => {
      const localFile = record.downloadLogs[0]?.filePath || null;
      const { downloadLogs, ...rest } = record;
      return { ...rest, localFilePath: localFile };
    });

    return {
      data: dataWithLocalPath,
      total,
      page: params.page,
      size: params.size,
      totalPages: Math.ceil(total / params.size),
    };
  }

  async getById(id: number) {
    return prisma.cdrRecord.findUnique({
      where: { id: BigInt(id) },
    });
  }

  private mapToCdrData(record: NxlinkCdrResponse) {
    return {
      orderId: record.orderId || null,
      callId: record.callId,
      agentName: record.agentName || null,
      agentNickName: record.agentNickName || null,
      caller: record.caller || null,
      callee: record.callee || null,
      direction: record.direction,
      answered: record.answered,
      callStatus: record.callStatus || null,
      startTime: record.startTime ? BigInt(record.startTime) : null,
      endTime: record.endTime ? BigInt(record.endTime) : null,
      answerTime: record.answerTime ? BigInt(record.answerTime) : null,
      ringTime: record.ringTime ? BigInt(record.ringTime) : null,
      callDuration: record.callDuration,
      ringDuration: record.ringDuration,
      queueDuration: record.queueDuration,
      hangupBy: record.hangupBy,
      hangupCode: record.hangupCode,
      hangupReason: record.hangupReason || null,
      recordUrl: record.recordUrl || null,
      leaveMsgUrl: record.leaveMsgUrl || null,
      mos: record.mos ? Number(record.mos) : null,
      totalCustomerPrice: record.totalCustomerPrice
        ? Number(record.totalCustomerPrice)
        : null,
      lineIp: record.lineIp || null,
    };
  }
}
