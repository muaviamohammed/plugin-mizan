import type { IAgentRuntime, Memory } from "@elizaos/core";
import { describe, expect, it } from "vitest";
import mizanPlugin from "../src";

const LIVE = process.env.MIZAN_LIVE === "1";

describe.skipIf(!LIVE)("live (MIZAN_LIVE=1)", () => {
  it("VERIFY_TRACK_RECORD verifies a real credential from the registry", async () => {
    const verify = mizanPlugin.actions!.find((a) => a.name === "VERIFY_TRACK_RECORD")!;
    const runtime = { getSetting: () => undefined } as unknown as IAgentRuntime;
    const r = await verify.handler(
      runtime,
      { content: { text: "Before I copy it: its MIZAN credential is v12-btc-trend-4h" } } as unknown as Memory,
      undefined,
      {},
    );
    console.log(r?.text);
    expect(r!.success).toBe(true);
    expect(r!.values!.mizanFound).toBe(true);
    expect(r!.values!.mizanHashMatch).toBe(true);
  }, 60_000);

  it("CHECK_AGENT reports an unknown wallet as UNVERIFIED and zkml12 as REFUSED", async () => {
    const check = mizanPlugin.actions!.find((a) => a.name === "CHECK_AGENT")!;
    const runtime = { getSetting: () => undefined } as unknown as IAgentRuntime;
    const m = (text: string) => ({ content: { text } }) as unknown as Memory;
    const a = await check.handler(runtime, m("Is 0xabc123 legit? I want to pay it."), undefined, {});
    const b = await check.handler(runtime, m("copy the bot named zkml12"), undefined, {});
    console.log(a?.text, "\n---\n", b?.text);
    expect(a!.values!.mizanStatus).toBe("UNVERIFIED");
    expect(b!.values!.mizanStatus).toBe("REFUSED");
  }, 60_000);
});
