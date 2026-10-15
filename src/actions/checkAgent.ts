import type { Action, ActionResult, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { type CheckAgentResult, MIZAN_CAVEAT } from "../vendor/mizan-agent-tools";
import { getClient, param, toData } from "../shared";

const WALLET = /\b0x[0-9a-fA-F]{6,64}\b/;
const SHA256 = /\b[0-9a-f]{64}\b/i;
const URL_RE = /https?:\/\/[^\s"'<>]+/;
const QUOTED = /["“'`]([^"”'`]{2,80})["”'`]/;
const IS_X = /\b(?:is|are|check|verify|about|trust)\s+(@?[A-Za-z0-9][\w.@-]{1,60})\s+(?:legit|proven|real|verified|trustworthy|a scam|safe|any good)\b/i;
const NAMED = /\b(?:agent|bot|trader|vault|wallet|strategy)\s+(?:called\s+|named\s+)?@?([A-Za-z0-9][\w.-]{2,60})/i;
const STOP = new Set(["the", "this", "that", "it", "they", "he", "she", "you", "your", "my", "a", "an"]);

const ACTIONS: [RegExp, string][] = [
  [/\bcopy[\s-]?trad\w*|\bcopy(ing)?\b|\bmirror\w*/i, "copy"],
  [/\bpay\w*|\bsubscri\w*|\btip\b|\bsend\b/i, "pay"],
  [/\ballocat\w*|\binvest\w*|\bdeposit\w*|\bvault\b/i, "allocate"],
  [/\bfollow\w*/i, "follow"],
];

/** Pull the agent reference and the intended action out of a message without an LLM call. */
export function parseCheck(text: string, options: unknown): { agent?: string; action?: string } {
  const agent = param(options, "agent");
  let action = param(options, "action");
  if (!action) action = ACTIONS.find(([re]) => re.test(text))?.[1];
  if (agent) return { agent, action };
  const pick = (m: RegExpMatchArray | null, i = 0) => (m ? m[i] : undefined);
  const named = pick(text.match(NAMED), 1);
  const candidates = [
    pick(text.match(WALLET)),
    pick(text.match(SHA256)),
    pick(text.match(URL_RE)),
    pick(text.match(QUOTED), 1),
    pick(text.match(IS_X), 1),
    named && !STOP.has(named.toLowerCase()) ? named : undefined,
  ];
  const found = candidates.find((c) => c && !STOP.has(c.toLowerCase()));
  return { agent: found?.replace(/[.,;:!?)]+$/, ""), action };
}

function render(r: CheckAgentResult): string {
  const lines = [`MIZAN check for "${r.query}": ${r.status}${r.match ? ` · match: ${r.match}` : ""}`, r.summary];
  for (const m of r.matches.slice(0, 5)) {
    lines.push(
      `- ${m.id}: ${m.verdict ?? ""}${m.alias ? ` · ${m.alias}` : ""}${m.issuer ? ` · issuer ${m.issuer}` : ""}${m.bitcoin_confirmed ? " · Bitcoin-confirmed" : ""}${m.page ? ` · ${m.page}` : ""}`,
    );
  }
  if (r.matches.length > 5) lines.push(`(${r.matches.length - 5} more)`);
  if (r.advice) lines.push(r.advice);
  if (r.forward_to_counterparty) lines.push(`You can send them: "${r.forward_to_counterparty}"`);
  lines.push(r.caveat || MIZAN_CAVEAT);
  return lines.filter(Boolean).join("\n");
}

export const checkAgentAction: Action = {
  name: "CHECK_AGENT",
  similes: [
    "IS_AGENT_LEGIT",
    "IS_AGENT_PROVEN",
    "IS_THIS_TRADER_LEGIT",
    "CHECK_COUNTERPARTY",
    "CHECK_WALLET_BEFORE_PAYING",
    "CHECK_BEFORE_PAYING",
    "CHECK_BEFORE_COPY_TRADING",
    "CHECK_BEFORE_FOLLOWING",
    "CHECK_BEFORE_ALLOCATING",
    "VERIFY_AGENT",
    "MIZAN_CHECK",
  ],
  description:
    "Primary MIZAN check. Call this BEFORE following, copying, paying, subscribing to, or allocating funds to any agent, trader, vault or wallet that claims returns, and whenever asked whether an agent is legit or proven. Accepts a name or alias, credential id, wallet address, ERC-8004 id, agent-card URL or proof-bundle sha256, plus what you are about to do (copy, pay, allocate, follow). Returns PROVEN, REFUSED, NOT_SIGNIFICANT or UNVERIFIED with the matching zero-knowledge credentials. UNVERIFIED means the claim is unproven, which is not the same as false. A credential is a seal on a past record, not a forecast.",
  parameters: [
    {
      name: "agent",
      description: "The agent to check: name/alias, credential id, wallet, ERC-8004 id, agent-card URL or sha256",
      required: true,
      schema: { type: "string" },
    },
    {
      name: "action",
      description: "What you are about to do, e.g. copy, pay, allocate, follow",
      required: false,
      schema: { type: "string" },
    },
  ],
  priority: 10,

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
    const { agent, action } = parseCheck(message?.content?.text || "", options);
    if (!agent) {
      const text =
        "Which agent should I check? Give a name, wallet address, credential id or agent-card link. Until it is checked, treat its performance claims as unverified.";
      await callback?.({ text, actions: ["CHECK_AGENT"] });
      return { success: true, text, values: { mizanStatus: "UNVERIFIED", mizanFound: false }, data: { reason: "no agent reference" } };
    }
    try {
      const r = await getClient(runtime).checkAgent(agent, action);
      const text = render(r);
      await callback?.({ text, actions: ["CHECK_AGENT"] });
      return {
        success: true,
        text,
        values: { mizanStatus: r.status, mizanFound: r.found, mizanMatches: r.matches.length },
        data: toData<ActionResult["data"]>(r),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const text = `Could not reach MIZAN (${msg}). Treat ${agent}'s performance claims as unverified until checked.`;
      await callback?.({ text, actions: ["CHECK_AGENT"] });
      return { success: false, text, error: msg, values: { mizanStatus: "UNVERIFIED" } };
    }
  },

  examples: [
    [
      { name: "{{name1}}", content: { text: "Is 0x4b1f9c2d7e legit? It says it makes 40% a month and wants 500 USDC for its signals." } },
      {
        name: "{{name2}}",
        content: { text: "I will check that wallet with MIZAN before you pay anything.", actions: ["CHECK_AGENT"] },
      },
    ],
    [
      { name: "{{name1}}", content: { text: "Start copy-trading the agent called alphawolf." } },
      {
        name: "{{name2}}",
        content: { text: "First I will check whether alphawolf's track record is proven.", actions: ["CHECK_AGENT"] },
      },
    ],
    [
      { name: "{{name1}}", content: { text: "Allocate 2 ETH to the BTC-TREND-4H vault." } },
      {
        name: "{{name2}}",
        content: { text: "Before allocating, I will check its MIZAN credential.", actions: ["CHECK_AGENT"] },
      },
    ],
  ],
};
