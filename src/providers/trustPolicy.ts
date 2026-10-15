import type { IAgentRuntime, Memory, Provider, ProviderResult, State } from "@elizaos/core";
import { TRUST_INTENT } from "../shared";

const POLICY =
  "Trust policy (MIZAN): before copying another agent's trades, paying for signals, or allocating funds based on a performance claim, verify the claim's MIZAN credential with VERIFY_TRACK_RECORD. Report the verdict exactly as issued. A claim without a credential is unverified. A credential is a seal on a past record, not a forecast.";

/** Adds a one-paragraph verification policy only when the message is about relying on someone's performance. */
export const mizanTrustPolicyProvider: Provider = {
  name: "MIZAN_TRUST_POLICY",
  description: "Reminds the agent to verify track records with MIZAN before copying, paying or allocating.",
  get: async (_runtime: IAgentRuntime, message: Memory, _state?: State): Promise<ProviderResult> => {
    const text = message?.content?.text || "";
    if (!TRUST_INTENT.test(text)) return { text: "", values: {}, data: {} };
    return { text: POLICY, values: { mizanTrustPolicy: POLICY }, data: {} };
  },
};
