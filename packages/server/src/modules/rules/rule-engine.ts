import { prisma } from "../../config/database.js";

type CdrRecordType = Awaited<ReturnType<typeof prisma.cdrRecord.findFirst>>;

export interface RuleMatchResult {
  matched: boolean;
  ruleId: bigint | null;
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
    if (rule.agentNames) {
      const agentNames = JSON.parse(rule.agentNames) as string[];
      if (agentNames.length > 0 && !agentNames.includes(cdr?.agentName || "")) {
        return false;
      }
    }

    if (rule.directions) {
      const directions = JSON.parse(rule.directions) as number[];
      if (directions.length > 0 && !directions.includes(cdr?.direction || 0)) {
        return false;
      }
    }

    if (rule.answeredOnly && !cdr?.answered) {
      return false;
    }

    if (rule.minDuration && (cdr?.callDuration || 0) < rule.minDuration) {
      return false;
    }

    return true;
  }
}
