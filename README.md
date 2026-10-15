# plugin-mizan

An elizaOS plugin that lets an agent check a [MIZAN](https://mizan.market) zero-knowledge
track-record credential **before it follows, copies, pays or allocates to another agent or wallet**
on the strength of a performance claim.

A MIZAN credential is a STARK proof under the open [VTR-1 standard](https://mizan.market/standard-spec)
that a trading or AI-agent track record was computed as claimed, under committed costs and data,
without revealing the strategy. FAIL verdicts are published alongside passes. A credential is a seal
on a past record, not a forecast.

## Install

```bash
npm install github:muaviamohammed/plugin-mizan   # until an npm release exists
```

Add it to a character by package name:

```ts
export const character = {
  name: "Trader",
  plugins: ["@elizaos/plugin-sql", /* model + wallet plugins */ "plugin-mizan"],
};
```

or pass the object directly when you build a runtime:

```ts
import { mizanPlugin } from "plugin-mizan";
// new AgentRuntime({ character, plugins: [mizanPlugin, ...] })
```

No API key. Optional setting `MIZAN_BASE_URL` (default `https://studio.mizan.market`).

## Components

| Component | What it does |
|---|---|
| `CHECK_AGENT` (primary action) | Call before following, copying, paying or allocating, or when asked "is X legit / proven?". Takes a name or alias, credential id, wallet, ERC-8004 id, agent-card URL or sha256 (parameter `agent`, or parsed from the text) plus the intended `action`, calls `GET /api/agents/check`, and replies PROVEN, REFUSED, NOT_SIGNIFICANT or UNVERIFIED with the matching credentials. UNVERIFIED means unproven, which is not the same as false; the reply includes a note the agent can forward to the counterparty. |
| `VERIFY_TRACK_RECORD` (action) | Finds a credential reference in the message (registry id, `.../credential/<id>` link, or bundle sha256) or reads `credentialId` / `sha256` parameters, looks it up in the public registry, checks the proof bundle's sha256 against the registry anchor, and replies with the verdict exactly as issued (PASS, FAIL, NOT_SIGNIFICANT, SIGNIFICANT, LEDGER_ENTRY) or UNVERIFIED. No credential reference means the claim is reported as unverified. |
| `SEARCH_PROVEN_AGENTS` (action) | Searches the registry by name, issuer or verdict (`query`, `verdict`, `issuer` parameters, or a quoted name and "passed"/"failed" in the text). |
| `MIZAN_TRUST_POLICY` (provider) | Adds a one-paragraph policy pointing the agent to `CHECK_AGENT`, only when the message is about relying on someone's performance. |

Action results carry structured `values` (`mizanStatus`, `mizanVerdict`, `mizanFound`, `mizanHashMatch`) so later
steps can gate on them, and `data` with the full result (era, dataset, disclosed metrics, link, caveat).

Targets `@elizaos/core` 1.7.x (npm `latest`) and type-checks against the 2.x beta. Actions declare
`parameters` for 2.x planners and fall back to deterministic text parsing on 1.x. No LLM calls are
made by the plugin.

## Limits, stated plainly

- The hash check proves the bundle is the one the registry anchored. It does not re-run the STARK;
  for full offline re-verification use the verifier at https://mizan.market/verify/.
- Every credential listed so far was issued by MIZAN itself (its own engines and open-testing mints).
- The plugin does not mint. Proving your own record uses the sealed path (positions only):
  https://mizan.market/skill/ or the MCP server at `https://studio.mizan.market/mcp`.

## Develop

```bash
npm install
npm run build
npm test            # unit tests, mocked fetch
npm run test:live   # live CHECK_AGENT and VERIFY_TRACK_RECORD against the real API
```

`src/vendor/mizan-agent-tools` is a copy of the `mizan-agent-tools` client (MIT); refresh it with
`npm run sync-client` (set `MIZAN_CLIENT_SRC` to the `src` folder of
https://github.com/muaviamohammed/mizan-agent-tools-js).

MIT licensed.
