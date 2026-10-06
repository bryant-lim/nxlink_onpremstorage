import { prisma } from "../../config/database.js";

type CdrRecordType = Awaited<ReturnType<typeof prisma.cdrRecord.findFirst>>;

export interface RuleMatchResult {
  matched: boolean;
  ruleId: bigint | null;
}

function parseJsonArray<T>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export class RuleEngine {
  async evaluateCdr(cdr: CdrRecordType): Promise<RuleMatchResult> {
    if (!cdr) {
      return { matched: false, ruleId: null };
    }

    const rules = await prisma.downloadRule.findMany({
      where: { isActive: true },
    });

    if (rules.length === 0) {
      return { matched: false, ruleId: null };
    }

    for (const rule of rules) {
      if (this.matchesRule(cdr, rule)) {
        return { matched: true, ruleId: rule.id };
      }
    }

    return { matched: false, ruleId: null };
  }

  private matchesRule(cdr: CdrRecordType, rule: any): boolean {
    const isAiBot = cdr?.recordingType === "ai_bot";

    // 1. Recording type check
    if (rule.recordingType && rule.recordingType !== "all") {
      const cdrType = cdr?.recordingType || "agent";
      if (rule.recordingType !== cdrType) {
        return false;
      }
    }

    // 2. Agent names filter (only applies to human agent calls)
    if (!isAiBot) {
      const agentNames = parseJsonArray<string>(rule.agentNames);
      if (agentNames.length > 0 && !agentNames.includes(cdr?.agentName || "")) {
        return false;
      }
    }

    // 3. Flow names filter (for AI bot calls if specified)
    if (isAiBot && rule.flowNames) {
      const flowNames = parseJsonArray<string>(rule.flowNames);
      if (flowNames.length > 0 && !flowNames.includes(cdr?.flowName || "")) {
        return false;
      }
    }

    // 4. Direction check
    const directions = parseJsonArray<number>(rule.directions);
    if (
      directions.length > 0 &&
      cdr?.direction !== null &&
      cdr?.direction !== undefined &&
      !directions.includes(cdr.direction)
    ) {
      return false;
    }

    // 5. Answered check
    if (rule.answeredOnly && cdr?.answered === false) {
      return false;
    }

    // 6. Minimum duration check
    if (rule.minDuration && (cdr?.callDuration || 0) < rule.minDuration) {
      return false;
    }

    return true;
  }
}
