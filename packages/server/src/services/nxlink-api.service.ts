import axios, { AxiosInstance, AxiosError } from "axios";
import { generateSignature, buildHeaders } from "../utils/signature.js";
import { logger } from "../utils/logger.js";
import {
  NxlinkCdrResponse,
  NxlinkApiResponse,
  CdrFilterParams,
} from "@nxlink-vr/shared";

export interface ApiConfigInput {
  apiGateway: string;
  accessKey: string;
  accessSecret: string;
  bizType: string;
  action: string;
}

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NxlinkApiService {
  private client: AxiosInstance;
  private config: ApiConfigInput;

  constructor(config: ApiConfigInput) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiGateway,
      timeout: 30000,
    });
  }

  private getAuthHeaders(
    body?: Record<string, unknown>,
  ): Record<string, string> {
    const ts = String(Date.now());
    const sign = generateSignature({
      accessKey: this.config.accessKey,
      accessSecret: this.config.accessSecret,
      bizType: this.config.bizType,
      action: this.config.action,
      ts,
      body,
    });

    return {
      "Content-Type": "application/json",
      accessKey: this.config.accessKey,
      ts,
      bizType: this.config.bizType,
      action: this.config.action,
      sign,
    };
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        const isRetryable =
          error instanceof AxiosError
            ? error.response?.status !== 401 && error.response?.status !== 403
            : true;

        if (!isRetryable || attempt === MAX_RETRIES) {
          break;
        }

        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        logger.warn(
          `${context} failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms: ${error.message}`,
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  async fetchCdrPage(params: CdrFilterParams): Promise<{
    data: NxlinkCdrResponse[];
    total: number;
    page: number;
    size: number;
  }> {
    const body = {
      answered: params.answered,
      direction: params.direction,
      startTime: params.startTime,
      endTime: params.endTime,
      name: params.name,
      caller: params.caller,
      callee: params.callee,
      callId: params.callId,
      orderId: params.orderId,
      page: params.page,
      size: params.size,
    };

    const headers = this.getAuthHeaders(body);

    logger.info(
      `Fetching CDR page ${params.page} from ${this.config.apiGateway}`,
    );

    const response = await this.withRetry(
      () =>
        this.client.post<NxlinkApiResponse<NxlinkCdrResponse[]>>(
          "/saas/cc/openapi/cdr/page",
          body,
          { headers },
        ),
      `CDR page ${params.page}`,
    );

    const { code, msg, data } = response.data;

    if (code !== 0) {
      const error = new Error(`NXLink API error [${code}]: ${msg}`);
      (error as any).code = code;
      throw error;
    }

    return {
      data: data || [],
      total: data?.length || 0,
      page: params.page,
      size: params.size,
    };
  }

  async fetchAllCdrs(
    params: Omit<CdrFilterParams, "page">,
  ): Promise<NxlinkCdrResponse[]> {
    const allRecords: NxlinkCdrResponse[] = [];
    let page = 1;
    const size = params.size || 100;

    while (true) {
      const result = await this.fetchCdrPage({ ...params, page, size });

      if (result.data.length === 0) {
        break;
      }

      allRecords.push(...result.data);

      if (result.data.length < size) {
        break;
      }

      page++;
    }

    logger.info(`Fetched ${allRecords.length} total CDR records`);
    return allRecords;
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 86400;
      const startTime = Date.now();

      logger.info(
        `[API Test] Connecting to ${this.config.apiGateway}/saas/cc/openapi/cdr/page`,
      );

      const response = await this.withRetry(() => {
        const body = { startTime: oneDayAgo, endTime: now, page: 1, size: 1 };
        const headers = this.getAuthHeaders(body);
        return this.client.post<NxlinkApiResponse<NxlinkCdrResponse[]>>(
          "/saas/cc/openapi/cdr/page",
          body,
          { headers },
        );
      }, "CDR connection test");

      const elapsed = Date.now() - startTime;
      const { code, msg, data } = response.data;

      const details = {
        gateway: this.config.apiGateway,
        httpStatus: response.status,
        apiCode: code,
        apiMessage: msg,
        responseTime: `${elapsed}ms`,
        recordsReturned: data?.length || 0,
        timestamp: new Date().toISOString(),
      };

      if (code !== 0) {
        logger.warn(
          `[API Test] Connected but API returned code ${code}: ${msg}`,
        );
        return {
          success: false,
          message: `API error [${code}]: ${msg}`,
          details,
        };
      }

      logger.info(
        `[API Test] Connection successful (${elapsed}ms, code=${code}, ${data?.length || 0} records)`,
      );
      return { success: true, message: "Connection successful", details };
    } catch (error: any) {
      const elapsed = Date.now() - (error.startTime || Date.now());
      const details = {
        gateway: this.config.apiGateway,
        httpStatus: error.response?.status || null,
        apiCode: error.response?.data?.code || null,
        apiMessage: error.response?.data?.msg || null,
        errorMessage: error.message,
        responseTime: `${elapsed}ms`,
        timestamp: new Date().toISOString(),
      };

      logger.error(
        `[API Test] Connection failed: ${error.message} (HTTP ${error.response?.status || "N/A"})`,
      );
      return {
        success: false,
        message: error.message || "Connection failed",
        details,
      };
    }
  }
}
