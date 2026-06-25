import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config/database.js", () => ({
  prisma: {
    downloadRule: {
      findMany: vi.fn(),
    },
  },
}));

describe("Rule Engine", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return no match when no rules exist", async () => {
    const { prisma } = await import("../../config/database.js");
    vi.mocked(prisma.downloadRule.findMany).mockResolvedValue([]);

    const { RuleEngine } = await import("./rule-engine.js");
    const engine = new RuleEngine();

    const cdr = {
      id: BigInt(1),
      callId: "test123",
      agentName: "NX0001",
      direction: 1,
      answered: true,
      callDuration: 60,
    } as any;

    const result = await engine.evaluateCdr(cdr);
    expect(result.matched).toBe(false);
  });

  it("should match rule when agent name matches", async () => {
    const { prisma } = await import("../../config/database.js");
    vi.mocked(prisma.downloadRule.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        agentNames: JSON.stringify(["NX0001", "NX0002"]),
        directions: null,
        answeredOnly: false,
        minDuration: null,
        isActive: true,
      },
    ]);

    const { RuleEngine } = await import("./rule-engine.js");
    const engine = new RuleEngine();

    const cdr = {
      id: BigInt(1),
      callId: "test123",
      agentName: "NX0001",
      direction: 1,
      answered: true,
      callDuration: 60,
    } as any;

    const result = await engine.evaluateCdr(cdr);
    expect(result.matched).toBe(true);
    expect(result.ruleId).toBe(BigInt(1));
  });

  it("should not match rule when agent name does not match", async () => {
    const { prisma } = await import("../../config/database.js");
    vi.mocked(prisma.downloadRule.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        agentNames: JSON.stringify(["NX0001", "NX0002"]),
        directions: null,
        answeredOnly: false,
        minDuration: null,
        isActive: true,
      },
    ]);

    const { RuleEngine } = await import("./rule-engine.js");
    const engine = new RuleEngine();

    const cdr = {
      id: BigInt(1),
      callId: "test123",
      agentName: "NX0003",
      direction: 1,
      answered: true,
      callDuration: 60,
    } as any;

    const result = await engine.evaluateCdr(cdr);
    expect(result.matched).toBe(false);
  });

  it("should not match rule when answeredOnly is true and call is not answered", async () => {
    const { prisma } = await import("../../config/database.js");
    vi.mocked(prisma.downloadRule.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        agentNames: null,
        directions: null,
        answeredOnly: true,
        minDuration: null,
        isActive: true,
      },
    ]);

    const { RuleEngine } = await import("./rule-engine.js");
    const engine = new RuleEngine();

    const cdr = {
      id: BigInt(1),
      callId: "test123",
      agentName: "NX0001",
      direction: 1,
      answered: false,
      callDuration: 0,
    } as any;

    const result = await engine.evaluateCdr(cdr);
    expect(result.matched).toBe(false);
  });

  it("should not match rule when duration is below minimum", async () => {
    const { prisma } = await import("../../config/database.js");
    vi.mocked(prisma.downloadRule.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        agentNames: null,
        directions: null,
        answeredOnly: false,
        minDuration: 30,
        isActive: true,
      },
    ]);

    const { RuleEngine } = await import("./rule-engine.js");
    const engine = new RuleEngine();

    const cdr = {
      id: BigInt(1),
      callId: "test123",
      agentName: "NX0001",
      direction: 1,
      answered: true,
      callDuration: 10,
    } as any;

    const result = await engine.evaluateCdr(cdr);
    expect(result.matched).toBe(false);
  });

  it("should match rule when all conditions are met", async () => {
    const { prisma } = await import("../../config/database.js");
    vi.mocked(prisma.downloadRule.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        agentNames: JSON.stringify(["NX0001"]),
        directions: JSON.stringify([1]),
        answeredOnly: true,
        minDuration: 10,
        isActive: true,
      },
    ]);

    const { RuleEngine } = await import("./rule-engine.js");
    const engine = new RuleEngine();

    const cdr = {
      id: BigInt(1),
      callId: "test123",
      agentName: "NX0001",
      direction: 1,
      answered: true,
      callDuration: 60,
    } as any;

    const result = await engine.evaluateCdr(cdr);
    expect(result.matched).toBe(true);
    expect(result.ruleId).toBe(BigInt(1));
  });
});
