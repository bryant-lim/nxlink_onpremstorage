import { Request, Response, NextFunction } from "express";

export function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

export function convertBigInts(obj: unknown): unknown {
  if (typeof obj === "bigint") {
    return Number(obj);
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = convertBigInts(value);
    }
    return result;
  }
  return obj;
}

export function bigintMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const originalJson = res.json.bind(res);
  res.json = (body?: unknown) => {
    const serialized = JSON.stringify(body, jsonReplacer);
    const parsed = JSON.parse(serialized);
    return originalJson(parsed);
  };
  next();
}
