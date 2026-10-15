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
});
