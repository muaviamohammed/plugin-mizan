import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from "@elizaos/core";
import { TRUST_INTENT } from "../shared";

const POLICY =
  "Trust policy (MIZAN): before copying another agent's trades, paying for signals, or allocating funds based on a performance claim, call CHECK_AGENT on that agent or wallet first (VERIFY_TRACK_RECORD for a specific credential id). Report the status exactly as returned. UNVERIFIED means unproven, which is not the same as false. A credential is a seal on a past record, not a forecast.";

/** Adds a one-paragraph verification policy only when the message is about relying on someone's performance. */
export const mizanTrustPolicyProvider: Provider = {
  name: "MIZAN_TRUST_POLICY",
  description: "Reminds the agent to call CHECK_AGENT before following, copying, paying or allocating.",
  get: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<ProviderResult> => {
    const text = message?.content?.text || "";
    if (!TRUST_INTENT.test(text)) return { text: "", values: {}, data: {} };
    return { text: POLICY, values: { mizanTrustPolicy: POLICY }, data: {} };
  },
};
