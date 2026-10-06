import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger.js";

export interface NxlinkAiConfig {
  aiTokenUrl?: string | null;
  aiAppUrl?: string | null;
  platToken?: string | null;
}

export interface AiConversationRecord {
  id: string;
  conversationId: string;
  phone?: string;
  flowName?: string;
  tags?: string[];
  summary?: string;
  sentiment?: string;
  startTime?: number; // epoch ms
  endTime?: number;   // epoch ms
  callDuration?: number; // seconds
  audioUrl?: string | null;
}

export class NxlinkAiService {
  private client: AxiosInstance;
  private tokenUrl: string | null;
  private appUrl: string;
  private cachedToken: string | null = null;

  constructor(config: NxlinkAiConfig) {
    this.appUrl = (config.aiAppUrl || "https://app.nxlink.ai").replace(/\/+$/, "");
    this.tokenUrl = config.aiTokenUrl || process.env.NXAI_TOKEN_URL || null;
    this.cachedToken = config.platToken || null;
    this.client = axios.create({
      baseURL: this.appUrl,
      timeout: 30000,
    });
  }

  async getPlatToken(forceRefresh = false): Promise<string | null> {
    if (this.cachedToken && !forceRefresh) {
      return this.cachedToken;
    }

    if (!this.tokenUrl) {
      if (this.cachedToken && forceRefresh) {
        logger.warn(
          "[Nxlink AI] plat_token expired (403) and no NXAI_TOKEN_URL is configured for auto-refresh. Please re-generate token in Settings.",
        );
      } else {
        logger.warn("[Nxlink AI] No plat_token or NXAI_TOKEN_URL configured");
      }
      return null;
    }

    try {
      logger.info("[Nxlink AI] Fetching fresh plat_token...");
      const res = await axios.get<{ token: string }>(this.tokenUrl, { timeout: 10000 });
      if (res.data?.token) {
        this.cachedToken = res.data.token;
        logger.info("[Nxlink AI] Fresh plat_token acquired successfully");
        return this.cachedToken;
      }
      logger.warn("[Nxlink AI] Token endpoint response did not contain token field");
      return null;
    } catch (err: any) {
      logger.error(`[Nxlink AI] Failed to fetch plat_token: ${err.message || err}`);
      return null;
    }
  }

  private async requestWithRetry<T>(
    fn: (token: string) => Promise<T>,
    actionName: string,
    maxRetries = 3
  ): Promise<T> {
    let token = await this.getPlatToken();
    if (!token) {
      throw new Error("Unable to obtain NXLink plat_token. Check NXAI_TOKEN_URL.");
    }

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn(token);
      } catch (error: any) {
        attempt++;
        const isAuthError =
          error.response?.status === 403 ||
          error.response?.status === 401 ||
          error.response?.data?.code === 403 ||
          error.response?.data?.code === "403";

        if (isAuthError && attempt < maxRetries) {
          logger.warn(`[Nxlink AI] ${actionName} received 403/auth error. Refreshing plat_token and retrying...`);
          const refreshed = await this.getPlatToken(true);
          if (refreshed) {
            token = refreshed;
            continue;
          }
        }

        if (attempt >= maxRetries) {
          logger.error(`[Nxlink AI] ${actionName} failed after ${maxRetries} attempts: ${error.message || error}`);
          throw error;
        }

        const delay = attempt * 2000;
        logger.warn(`[Nxlink AI] ${actionName} error: ${error.message}. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error(`[Nxlink AI] Failed ${actionName} after ${maxRetries} attempts`);
  }

  async fetchConversationAudioUrl(conversationId: string): Promise<string | null> {
    return this.requestWithRetry(async (token) => {
      const res = await this.client.get(
        `/admin/nx_flow_manager/conversation/messages?pageSize=9999&pageNumber=1&conversationId=${encodeURIComponent(conversationId)}`,
        {
          headers: {
            authorization: token,
          },
        }
      );

      const data = res.data;
      const messages = data?.data || data?.list || [];

      if (Array.isArray(messages)) {
        for (const m of messages) {
          if (m?.msgInfo && typeof m.msgInfo === "string" && m.msgInfo.includes("audio_url")) {
            try {
              const parsed = JSON.parse(m.msgInfo);
              if (parsed.audio_url) {
                return parsed.audio_url;
              }
            } catch {
              // ignore malformed msgInfo
            }
          }
        }
      }

      return null;
    }, `Fetch messages for conversation ${conversationId}`);
  }

  async fetchConversationsPage(params: {
    page: number;
    size: number;
  }): Promise<{ list: any[]; total: number }> {
    return this.requestWithRetry(async (token) => {
      const body: Record<string, any> = {
        phone: null,
        tags: [],
        page_number: params.page,
        page_size: params.size,
        timeZone: "UTC+08:00",
      };

      const res = await this.client.post("/admin/nx_flow_manager/conversation", body, {
        headers: {
          authorization: token,
          "content-type": "application/json",
        },
      });

      const data = res.data;
      const list = Array.isArray(data?.data?.list)
        ? data.data.list
        : (Array.isArray(data?.list)
          ? data.list
          : (Array.isArray(data?.data) ? data.data : []));
      const total = typeof data?.data?.total === "number"
        ? data.data.total
        : (typeof data?.total === "number" ? data.total : list.length);

      return { list, total };
    }, `Fetch AI conversations page ${params.page}`);
  }

  async fetchAllConversations(params: {
    startTimeSeconds?: number;
    endTimeSeconds?: number;
    maxConversations?: number;
  }): Promise<AiConversationRecord[]> {
    const records: AiConversationRecord[] = [];
    let page = 1;
    const size = 100;
    const max = params.maxConversations || 10000;
    const startTimeSec = params.startTimeSeconds;
    const endTimeSec = params.endTimeSeconds;

    logger.info(
      `[Nxlink AI] Starting AI voice bot conversation fetch (window: ${startTimeSec || "all"} - ${endTimeSec || "now"})...`,
    );

    let hasMoreInWindow = true;

    while (records.length < max && hasMoreInWindow) {
      const { list, total } = await this.fetchConversationsPage({
        page,
        size,
      });

      if (!list || list.length === 0) {
        break;
      }

      for (const conv of list) {
        const convId = conv.id || conv.conversationId || conv.uuid;
        if (!convId) continue;

        const rawTs = conv.created_at || conv.createdAt || conv.create_time || conv.createTime;
        let createdSec: number | undefined;
        let startMs: number | undefined;
        if (rawTs) {
          createdSec = typeof rawTs === "number" ? (rawTs > 10000000000 ? Math.floor(rawTs / 1000) : rawTs) : Math.floor(new Date(rawTs).getTime() / 1000);
          startMs = createdSec * 1000;
        }

        // If records are older than startTimeSeconds, we have scanned past the lookback window
        if (startTimeSec && createdSec && createdSec < startTimeSec) {
          hasMoreInWindow = false;
          continue;
        }

        // If record is newer than endTimeSeconds, skip it for this window
        if (endTimeSec && createdSec && createdSec > endTimeSec) {
          continue;
        }

        let audioUrl: string | null = conv.call_audio_url || conv.callAudioUrl || null;

        // If audio url is not on conversation header, query messages
        if (!audioUrl) {
          try {
            audioUrl = await this.fetchConversationAudioUrl(String(convId));
          } catch (e: any) {
            logger.warn(`[Nxlink AI] Could not fetch audio URL for bot conversation ${convId}: ${e.message}`);
          }
        }

        let tags: string[] = [];
        if (Array.isArray(conv.tags)) {
          tags = conv.tags.map((t: any) => (typeof t === "string" ? t : t?.name)).filter(Boolean);
        }

        records.push({
          id: String(convId),
          conversationId: String(convId),
          phone: conv.phone || conv.customer_phone || conv.customerPhone || null,
          flowName: conv.auto_flow_name || conv.flow_name || conv.flowName || null,
          tags,
          summary: conv.conv_summary || conv.summary || conv.full_summary || null,
          sentiment: conv.sentiment || null,
          startTime: startMs,
          audioUrl,
        });
      }

      logger.info(`[Nxlink AI] Page ${page} processed: ${list.length} sessions (matching records accumulated: ${records.length}/${total})`);

      if (!hasMoreInWindow || records.length >= total || list.length < size) {
        break;
      }

      page++;

      // Pacing requirement (§4 of guide: ~0.5s between pages)
      await new Promise((r) => setTimeout(r, 500));
    }

    logger.info(`[Nxlink AI] Total matching AI voice bot sessions: ${records.length}`);
    return records;
  }
}
