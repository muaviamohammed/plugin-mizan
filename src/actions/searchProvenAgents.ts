import type { Action, ActionResult, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { MIZAN_CAVEAT, type SearchQuery } from "../vendor/mizan-agent-tools";
import { getClient, param, toData } from "../shared";

const VERDICTS: [RegExp, string][] = [
  [/\bnot[\s_-]?significant\b/i, "NOT_SIGNIFICANT"],
  [/\b(pass|passed|passing)\b/i, "PASS"],
  [/\b(fail|failed|failing|refused)\b/i, "FAIL"],
];

/** Build a search query from explicit parameters, or from the message text without an LLM call. */
export function queryFrom(text: string, options: unknown): SearchQuery {
  const q: SearchQuery = { limit: 5 };
  const pQuery = param(options, "query");
  const pVerdict = param(options, "verdict");
  const pIssuer = param(options, "issuer");
  if (pQuery || pVerdict || pIssuer) {
    if (pQuery) q.query = pQuery;
    if (pVerdict) q.verdict = pVerdict.toUpperCase().replace(/\s+/g, "_");
    if (pIssuer) q.issuer = pIssuer;
    return q;
  }
  const quoted = text.match(/["“']([^"”']{2,80})["”']/)?.[1];
  if (quoted) q.query = quoted;
  for (const [re, v] of VERDICTS) {
    if (re.test(text)) {
      q.verdict = v;
      break;
    }
  }
  return q;
}

export const searchProvenAgentsAction: Action = {
  name: "SEARCH_PROVEN_AGENTS",
  similes: [
    "FIND_PROVEN_AGENTS",
    "FIND_VERIFIED_STRATEGIES",
    "SEARCH_MIZAN_REGISTRY",
    "LIST_VERIFIED_TRACK_RECORDS",
    "FIND_AGENTS_WITH_CREDENTIALS",
  ],
  description:
    "Search the public MIZAN registry of zero-knowledge track-record credentials by name, issuer or verdict (PASS, FAIL, NOT_SIGNIFICANT). Use this when looking for agents or strategies whose track records carry a credential, or to find the credential id of an agent you are about to copy, pay or allocate to; then use VERIFY_TRACK_RECORD on the id. Every credential listed so far was issued by MIZAN itself. A credential is a seal on a past record, not a forecast.",
  parameters: [
    { name: "query", description: "Free text: agent or strategy name, dataset, e.g. 'btc trend'", required: false, schema: { type: "string" } },
    {
      name: "verdict",
      description: "Filter by verdict",
      required: false,
      schema: { type: "string", enum: ["PASS", "FAIL", "NOT_SIGNIFICANT", "SIGNIFICANT", "LEDGER_ENTRY"] },
    },
    { name: "issuer", description: "Issuer name substring", required: false, schema: { type: "string" } },
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
    try {
      const q = queryFrom(message?.content?.text || "", options);
      const r = await getClient(runtime).searchCredentials(q);
      const head = `MIZAN registry: ${r.total} credential(s) match${q.verdict ? ` verdict ${q.verdict}` : ""}${q.query ? ` "${q.query}"` : ""}.`;
      const rows = r.credentials.map(
        (c) => `- ${c.id}: ${c.verdict}${c.alias ? ` · ${c.alias}` : ""}${c.issuer ? ` · issuer ${c.issuer}` : ""}${c.sandbox ? " · sandbox" : ""} · ${c.link}`,
      );
      const text = [head, ...rows, MIZAN_CAVEAT].join("\n");
      await callback?.({ text, actions: ["SEARCH_PROVEN_AGENTS"] });
      return {
        success: true,
        text,
        values: { mizanSearchTotal: r.total },
        data: toData<ActionResult["data"]>(r),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const text = `Could not search the MIZAN registry (${msg}).`;
      await callback?.({ text, actions: ["SEARCH_PROVEN_AGENTS"] });
      return { success: false, text, error: msg };
    }
  },

  examples: [
    [
      { name: "{{name1}}", content: { text: "Which trading agents have a MIZAN credential that passed?" } },
      {
        name: "{{name2}}",
        content: { text: "I will search the MIZAN registry for PASS credentials.", actions: ["SEARCH_PROVEN_AGENTS"] },
      },
    ],
  ],
};
