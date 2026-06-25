import crypto from "crypto";

interface SignatureParams {
  accessKey: string;
  accessSecret: string;
  bizType: string;
  action: string;
  ts: string;
  body?: Record<string, unknown>;
}

export function generateSignature(params: SignatureParams): string {
  const { accessKey, accessSecret, bizType, action, ts, body } = params;

  const headerParams = {
    accessKey,
    action,
    bizType,
    ts,
  };

  const headersStr = Object.keys(headerParams)
    .sort()
    .map((key) => `${key}=${headerParams[key as keyof typeof headerParams]}`)
    .join("&");

  let bodyStr = "";
  if (body && Object.keys(body).length > 0) {
    bodyStr = `&body=${JSON.stringify(body)}`;
  }

  const accessSecretStr = `&accessSecret=${accessSecret}`;

  const rawString = headersStr + bodyStr + accessSecretStr;

  return crypto.createHash("md5").update(rawString).digest("hex").toLowerCase();
}

export function buildHeaders(params: SignatureParams): Record<string, string> {
  const { accessKey, bizType, action, accessSecret } = params;
  const ts = params.ts || String(Date.now());
  const sign = generateSignature({ ...params, ts, accessSecret });

  return {
    "Content-Type": "application/json",
    accessKey,
    ts,
    bizType,
    action,
    sign,
  };
}
