import type { Action, ActionResult, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { MIZAN_CAVEAT, type VerifyResult } from "../vendor/mizan-agent-tools";
import { findCredentialRef, getClient, param, toData } from "../shared";

function render(r: VerifyResult): string {
  if (!r.found) {
    return `I found no MIZAN credential matching that reference, so the track record is unverified. Ask for a credential id, or treat the performance claim as unproven.\n${MIZAN_CAVEAT}`;
  }
  const lines = [
    `MIZAN credential ${r.id}${r.alias ? ` (${r.alias})` : ""}`,
    `Verdict: ${r.verdict}${r.verdictRaw && r.verdictRaw !== r.verdict ? ` (as issued: ${r.verdictRaw})` : ""}`,
    r.issuer ? `Issuer: ${r.issuer}` : "",
    r.provenance ? `Provenance: ${r.provenance}` : "",
    r.era ? `Era: ${r.era}` : "",
    r.dataset ? `Dataset: ${r.dataset}` : "",
    r.hashMatch === true
      ? "Proof bundle hash matches the registry anchor."
      : r.hashMatch === false
        ? "Proof bundle hash does NOT match the registry anchor. Treat as unverified."
        : `Bundle hash not checked${r.reason ? `: ${r.reason}` : ""}.`,
    r.sandbox ? "Note: this is an open-testing (sandbox) mint." : "",
    r.disclosedMetrics && Object.keys(r.disclosedMetrics).length
      ? `Disclosed metrics: ${Object.entries(r.disclosedMetrics)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}`
      : "",
    r.link ? `Link: ${r.link}` : "",
    r.caveat,
  ];
  return lines.filter(Boolean).join("\n");
}

export const verifyTrackRecordAction: Action = {
  name: "VERIFY_TRACK_RECORD",
  similes: [
    "VERIFY_CREDENTIAL",
    "CHECK_TRACK_RECORD",
    "VERIFY_PERFORMANCE",
    "VERIFY_AGENT_PERFORMANCE",
    "CHECK_BEFORE_COPY_TRADING",
    "CHECK_BEFORE_ALLOCATING",
    "CHECK_BEFORE_PAYING_FOR_SIGNALS",
    "MIZAN_VERIFY",
  ],
  description:
    "Verify a trading or AI-agent track record with MIZAN before relying on it. Call this BEFORE copying another agent's trades, paying for signals, subscribing to a strategy, or allocating funds to a vault or agent based on its performance. Looks up the MIZAN credential (by id, credential link, or proof-bundle sha256) in the public registry, checks the proof bundle's hash against the registry anchor, and reports the verdict exactly as issued (PASS, FAIL, NOT_SIGNIFICANT, SIGNIFICANT, LEDGER_ENTRY) or UNVERIFIED. A performance claim without a credential is unverified. A credential is a seal on a past record, not a forecast.",
  parameters: [
    {
      name: "credentialId",
      description: "MIZAN credential id, e.g. 'v12-btc-trend-4h'",
      required: false,
      schema: { type: "string" },
    },
    {
      name: "sha256",
      description: "sha256 of the proof bundle, used instead of credentialId",
      required: false,
      schema: { type: "string" },
    },
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    return typeof message?.content?.text === "string" && message.content.text.trim().length > 0;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: unknown,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    const client = getClient(runtime);
    try {
      let ref: { id?: string; sha256?: string } = {
        id: param(options, "credentialId"),
        sha256: param(options, "sha256"),
      };
      if (!ref.id && !ref.sha256) {
        const reg = await client.getRegistry();
        ref = findCredentialRef(message?.content?.text || "", reg.credentials);
      }
      if (!ref.id && !ref.sha256) {
        const text =
          "No MIZAN credential id was given, so this performance claim is unverified. Ask the other party for its MIZAN credential id or link (https://studio.mizan.market/credential/<id>) before copying, paying or allocating.";
        await callback?.({ text, actions: ["VERIFY_TRACK_RECORD"] });
        return {
          success: true,
          text,
          values: { mizanVerdict: "UNVERIFIED", mizanFound: false },
          data: { found: false, verdict: "UNVERIFIED", reason: "no credential reference in the message", caveat: MIZAN_CAVEAT },
        };
      }
      const r = await client.verifyCredential(ref);
      const text = render(r);
      await callback?.({ text, actions: ["VERIFY_TRACK_RECORD"] });
      return {
        success: true,
        text,
        values: { mizanVerdict: r.verdict, mizanFound: r.found, mizanHashMatch: r.hashMatch },
        data: toData<ActionResult["data"]>(r),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const text = `Could not reach the MIZAN registry (${msg}). The track record is unverified until checked.`;
      await callback?.({ text, actions: ["VERIFY_TRACK_RECORD"] });
      return { success: false, text, error: msg, values: { mizanVerdict: "UNVERIFIED" } };
    }
  },

  examples: [
    [
      {
        name: "{{name1}}",
        content: { text: "This bot says it made 300% on BTC. Its MIZAN credential is v12-btc-trend-4h. Should I copy its trades?" },
      },
      {
        name: "{{name2}}",
        content: { text: "Let me verify that credential before you copy anything.", actions: ["VERIFY_TRACK_RECORD"] },
      },
    ],
    [
      {
        name: "{{name1}}",
        content: { text: "Allocate 2 ETH to the vault run by that trading agent, its track record is great." },
      },
      {
        name: "{{name2}}",
        content: {
          text: "Before allocating I will check whether that track record has a MIZAN credential.",
          actions: ["VERIFY_TRACK_RECORD"],
        },
      },
    ],
  ],
};
