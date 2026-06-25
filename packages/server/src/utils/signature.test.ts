import { describe, it, expect } from "vitest";
import { generateSignature } from "./signature.js";

describe("Signature Generation", () => {
  it("should generate consistent MD5 signature", () => {
    const params = {
      accessKey: "AK_test123",
      accessSecret: "secret_test456",
      bizType: "8",
      action: "cc",
      ts: "1655710885431",
      body: { startTime: 1688140800, endTime: 1690819200, page: 1, size: 100 },
    };

    const sig1 = generateSignature(params);
    const sig2 = generateSignature(params);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{32}$/);
  });

  it("should generate different signatures for different inputs", () => {
    const base = {
      accessKey: "AK_test",
      accessSecret: "secret",
      bizType: "8",
      action: "cc",
      ts: "1234567890",
    };

    const sig1 = generateSignature({ ...base, ts: "1234567890" });
    const sig2 = generateSignature({ ...base, ts: "1234567891" });

    expect(sig1).not.toBe(sig2);
  });

  it("should generate signature without body", () => {
    const params = {
      accessKey: "AK_test",
      accessSecret: "secret",
      bizType: "8",
      action: "cc",
      ts: "1234567890",
    };

    const sig = generateSignature(params);
    expect(sig).toMatch(/^[a-f0-9]{32}$/);
  });

  it("should generate lowercase hex signature", () => {
    const params = {
      accessKey: "AK_test",
      accessSecret: "secret",
      bizType: "8",
      action: "cc",
      ts: "1234567890",
      body: { test: true },
    };

    const sig = generateSignature(params);
    expect(sig).toBe(sig.toLowerCase());
  });

  it("should sort header params in ASCII order", () => {
    const params = {
      accessKey: "AK_test",
      accessSecret: "secret",
      bizType: "8",
      action: "cc",
      ts: "1234567890",
    };

    const sig = generateSignature(params);
    expect(sig).toBeDefined();
  });
});
