import type { IAgentRuntime } from "@elizaos/core";
import { MizanClient, type RegistryCredential } from "./vendor/mizan-agent-tools";

const clients = new Map<string, MizanClient>();

/** One cached client per base URL (registry responses are cached for 60 s inside the client). */
export function getClient(runtime?: IAgentRuntime): MizanClient {
  const fromSetting = runtime?.getSetting?.("MIZAN_BASE_URL");
  const base = typeof fromSetting === "string" && fromSetting ? fromSetting : "https://studio.mizan.market";
  let c = clients.get(base);
  if (!c) {
    c = new MizanClient({ baseUrl: base, userAgent: "plugin-mizan/0.1.0 (+https://mizan.market/skill/)" });
    clients.set(base, c);
  }
  return c;
}

/** Test hook: replace the cached client. */
export function setClient(client: MizanClient, base = "https://studio.mizan.market"): void {
  clients.set(base, client);
}

const SHA256 = /\b[0-9a-f]{64}\b/i;
const CRED_URL = /\/credential\/([A-Za-z0-9_.-]+)/;

/** Read an explicit parameter (elizaOS 2.x passes validated parameters in options.parameters). */
export function param(options: unknown, key: string): string | undefined {
  const o = options as { parameters?: Record<string, unknown> } | undefined;
  const v = o?.parameters?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Find a credential reference in free text without an LLM call: a bundle sha256, a
 * .../credential/<id> link, or any token that is an id in the live registry.
 */
export function findCredentialRef(
  text: string,
  credentials: Pick<RegistryCredential, "id">[],
): { id?: string; sha256?: string } {
  const sha = text.match(SHA256)?.[0];
  if (sha) return { sha256: sha.toLowerCase() };
  const url = text.match(CRED_URL)?.[1];
  if (url) return { id: url };
  const ids = new Set(credentials.map((c) => c.id));
  const tokens = text.split(/[\s,;:!?()"'`<>[\]{}]+/).map((t) => t.replace(/[.]+$/, ""));
  const hit = tokens.find((t) => ids.has(t));
  return hit ? { id: hit } : {};
}

/** Words that signal the agent is about to rely on someone else's performance claim. */
export const TRUST_INTENT =
  /\b(copy|copying|copy-?trad\w*|mirror|follow(ing)?\s+(the\s+)?(trades?|signals?|strategy)|pay(ing)?\s+for\s+(signals?|alpha|access)|subscribe|allocat\w*|invest\w*|deposit\w*\s+(in|into)|vault|track\s*record|tear-?sheet|backtest|sharpe|performance|returns?|verify|verified|credential|proven|legit|scam|trust\w*|pnl|p&l)\b/i;

/** JSON-safe copy of a result for ActionResult.data (typed loosely across elizaOS 1.x and 2.x). */
export function toData<T>(x: unknown): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
