export type UserRole = "admin" | "manager" | "viewer";

export interface User {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type Region = "APAC" | "AMER" | "APAC_IDN";
export type RecordingType = "agent" | "ai_bot";

export interface ApiConfig {
  id: number;
  name: string;
  region: Region;
  apiGateway: string;
  aiTokenUrl?: string | null;
  aiAppUrl?: string | null;
  platToken?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CdrRecord {
  id: number;
  orderId: string | null;
  callId: string;
  conversationId?: string | null;
  recordingType?: string;
  flowName?: string | null;
  tags?: string[] | null;
  summary?: string | null;
  agentName: string | null;
  agentNickName: string | null;
  caller: string | null;
  callee: string | null;
  direction: number | null;
  answered: boolean | null;
  callStatus: string | null;
  startTime: number | null;
  endTime: number | null;
  answerTime: number | null;
  ringTime: number | null;
  callDuration: number | null;
  ringDuration: number | null;
  queueDuration: number | null;
  hangupBy: number | null;
  hangupCode: number | null;
  hangupReason: string | null;
  recordUrl: string | null;
  leaveMsgUrl: string | null;
  mos: number | null;
  totalCustomerPrice: number | null;
  lineIp: string | null;
  syncedAt: Date;
}

export type DownloadStatus =
  | "pending"
  | "downloading"
  | "success"
  | "failed"
  | "skipped";
export type TriggeredBy = "scheduler" | "manual";

export interface DownloadLog {
  id: number;
  cdrId: number;
  ruleId: number | null;
  status: DownloadStatus;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  retryCount: number;
  triggeredBy: TriggeredBy;
  triggeredByUserId: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface DownloadRule {
  id: number;
  name: string;
  recordingType?: string | null;
  agentNames: string[] | null;
  directions: number[] | null;
  flowNames?: string[] | null;
  answeredOnly: boolean;
  minDuration: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerConfig {
  id: number;
  cronExpression: string;
  lookbackHours: number;
  pageSize: number;
  storagePath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyLog {
  id: number;
  logDate: string;
  totalCdrsSynced: number;
  totalDownloadsAttempted: number;
  totalDownloadsSuccess: number;
  totalDownloadsFailed: number;
  totalDownloadsSkipped: number;
  totalSizeBytes: number;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface UserPreference {
  id: number;
  userId: number;
  visibleColumns: string[];
  columnOrder: string[] | null;
  pageSize: number;
}

export interface NxlinkCdrResponse {
  agentName: string | null;
  agentNickName: string | null;
  answered: boolean;
  answerTime: number;
  callDuration: number;
  callee: string;
  caller: string;
  callId: string;
  orderId: string;
  direction: number;
  dtmfKeys: string | null;
  endTime: number;
  hangupBy: number;
  hangupCode: number;
  callStatus: string;
  hangupReason: string;
  inQueueTime: number;
  leaveMsgUrl: string | null;
  other: string | null;
  intent: string | null;
  outQueueTime: number;
  queueDuration: number;
  recordUrl: string | null;
  ringDuration: number;
  ringTime: number;
  startTime: number;
  taskId: string;
  totalCustomerPrice: number;
  lineIp: string;
  mediaIp: string;
  termSipCode: number;
  hangupCause: string;
  mos: number;
}

export interface NxlinkApiResponse<T> {
  reqId: string;
  code: number;
  msg: string;
  data: T;
}

export interface CdrFilterParams {
  answered?: number;
  direction?: number;
  recordingType?: string;
  startTime: number;
  endTime: number;
  name?: string;
  caller?: string;
  callee?: string;
  callId?: string;
  orderId?: string;
  page: number;
  size: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}
