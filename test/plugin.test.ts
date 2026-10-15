import { createHash } from "node:crypto";
import type { IAgentRuntime, Memory } from "@elizaos/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import mizanPlugin, { MizanClient } from "../src";
import { queryFrom } from "../src/actions/searchProvenAgents";
import { findCredentialRef, setClient } from "../src/shared";

const BUNDLE = new TextEncoder().encode("bundle-bytes");
const FULL = createHash("sha256").update(BUNDLE).digest("hex");
const registry = {
  registry_root: "root123",
  credentials: [
    {
      id: "v12-btc-trend-4h",
      alias: "BTC-TREND-4H",
      issuer: "MIZAN",
      dataset: "BTC 4h",
      verdict: "PASS",
      era: "guest v12",
      anchor: { sha256: FULL },
      disclosed_metrics: { sharpe: 1.34, mdd_pct: 22.26 },
      links: { bundle: "https://mizan.market/verify/files/a.bundle" },
    },
    {
      id: "legend-spy-buyhold",
      alias: "SPY buy and hold",
      issuer: "MIZAN",
      verdict: "FAIL — published anyway",
      anchor: { sha256: "ff".repeat(32) },
      links: { bundle: "https://mizan.market/verify/files/spy.bundle" },
    },
  ],
};

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
let fetchMock: ReturnType<typeof vi.fn>;
function install(routes: Record<string, () => Response>) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const k = Object.keys(routes).find((r) => String(input).endsWith(r));
    return k ? routes[k]() : new Response("nf", { status: 404 });
  });
  setClient(new MizanClient({ fetch: fetchMock as unknown as typeof fetch, cacheTtlMs: 0 }));
}
const runtime = { getSetting: () => undefined } as unknown as IAgentRuntime;
const msg = (text: string) => ({ content: { text } }) as unknown as Memory;
const verify = mizanPlugin.actions!.find((a) => a.name === "VERIFY_TRACK_RECORD")!;
const search = mizanPlugin.actions!.find((a) => a.name === "SEARCH_PROVEN_AGENTS")!;
const provider = mizanPlugin.providers![0];

beforeEach(() =>
  install({
    "/api/registry": () => json(registry),
    "/api/public/registry": () => json({ credentials: [{ id: "v12-btc-trend-4h", provenance: "BACKTEST" }] }),
    "/a.bundle": () => new Response(BUNDLE),
    "/spy.bundle": () => new Response(BUNDLE),
  }),
);

describe("plugin shape", () => {
  it("exports the two actions, a provider, and pre-trust descriptions", () => {
    expect(mizanPlugin.name).toBe("mizan");
    expect(mizanPlugin.actions!.map((a) => a.name)).toEqual(["VERIFY_TRACK_RECORD", "SEARCH_PROVEN_AGENTS"]);
    expect(verify.description).toMatch(/BEFORE copying/);
    expect(verify.similes).toContain("CHECK_BEFORE_COPY_TRADING");
    expect(verify.examples!.length).toBeGreaterThan(0);
    expect(provider.name).toBe("MIZAN_TRUST_POLICY");
  });
});

describe("findCredentialRef", () => {
  it("finds a registry id, a credential link, or a sha256", () => {
    const creds = registry.credentials;
    expect(findCredentialRef("copy v12-btc-trend-4h?", creds)).toEqual({ id: "v12-btc-trend-4h" });
    expect(findCredentialRef("see https://studio.mizan.market/credential/abc_123 now", creds)).toEqual({ id: "abc_123" });
    expect(findCredentialRef(`bundle ${FULL.toUpperCase()}`, creds)).toEqual({ sha256: FULL });
    expect(findCredentialRef("no reference here", creds)).toEqual({});
  });
});

describe("VERIFY_TRACK_RECORD", () => {
  it("verifies an id found in the message and reports verdict, hash, provenance and caveat", async () => {
    const cb = vi.fn(async () => []);
    const r = await verify.handler(runtime, msg("Its credential is v12-btc-trend-4h. Copy it?"), undefined, {}, cb);
    expect(r && r.success).toBe(true);
    expect(r!.values!.mizanVerdict).toBe("PASS");
    expect(r!.values!.mizanHashMatch).toBe(true);
    expect(r!.text).toContain("Provenance: BACKTEST");
    expect(r!.text).toContain("not a forecast");
    expect(cb).toHaveBeenCalledOnce();
  });

  it("uses explicit parameters (elizaOS 2.x) and downgrades a tampered bundle", async () => {
    const r = await verify.handler(runtime, msg("check it"), undefined, { parameters: { credentialId: "legend-spy-buyhold" } });
    expect(r!.values!.mizanVerdict).toBe("UNVERIFIED");
    expect(r!.text).toMatch(/does NOT match/);
  });

  it("reports UNVERIFIED when the message has no credential reference", async () => {
    const r = await verify.handler(runtime, msg("this bot made 300%, should I copy it?"), undefined, {});
    expect(r!.values!.mizanVerdict).toBe("UNVERIFIED");
    expect(r!.values!.mizanFound).toBe(false);
    expect(r!.text).toMatch(/unverified/);
  });

  it("reports an unknown id as not found", async () => {
    const r = await verify.handler(runtime, msg("x"), undefined, { parameters: { credentialId: "nope" } });
    expect(r!.values!.mizanFound).toBe(false);
    expect(r!.text).toMatch(/no MIZAN credential/);
  });

  it("fails soft when the registry is down", async () => {
    install({ "/api/registry": () => json({}, 503) });
    const r = await verify.handler(runtime, msg("v12-btc-trend-4h"), undefined, {});
    expect(r!.success).toBe(false);
    expect(r!.text).toMatch(/unverified until checked/);
  });
});

describe("SEARCH_PROVEN_AGENTS", () => {
  it("parses verdict and quoted names from text", () => {
    expect(queryFrom('find "btc trend" agents that passed', {})).toMatchObject({ query: "btc trend", verdict: "PASS" });
    expect(queryFrom("show not significant ones", {})).toMatchObject({ verdict: "NOT_SIGNIFICANT" });
    expect(queryFrom("anything", { parameters: { verdict: "fail" } })).toMatchObject({ verdict: "FAIL" });
  });

  it("lists matching credentials with links and the caveat", async () => {
    const r = await search.handler(runtime, msg("which agents passed?"), undefined, {});
    expect(r!.success).toBe(true);
    expect(r!.values!.mizanSearchTotal).toBe(1);
    expect(r!.text).toContain("v12-btc-trend-4h: PASS");
    expect(r!.text).toContain("/credential/v12-btc-trend-4h");
    expect(r!.text).toContain("not a forecast");
  });
});

describe("MIZAN_TRUST_POLICY provider", () => {
  it("only speaks when the message is about relying on a performance claim", async () => {
    const on = await provider.get(runtime, msg("should I copy this trader's signals?"), {} as never);
    const off = await provider.get(runtime, msg("what is the weather today"), {} as never);
    expect(on.text).toMatch(/VERIFY_TRACK_RECORD/);
    expect(off.text).toBe("");
  });
});
