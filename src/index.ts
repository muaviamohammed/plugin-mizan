import type { Plugin } from "@elizaos/core";
import { checkAgentAction } from "./actions/checkAgent";
import { searchProvenAgentsAction } from "./actions/searchProvenAgents";
import { verifyTrackRecordAction } from "./actions/verifyTrackRecord";
import { mizanTrustPolicyProvider } from "./providers/trustPolicy";

export const mizanPlugin: Plugin = {
  name: "mizan",
  description:
    "Check an agent's MIZAN zero-knowledge track-record credential before following, copying, paying or allocating to it.",
  actions: [checkAgentAction, verifyTrackRecordAction, searchProvenAgentsAction],
  providers: [mizanTrustPolicyProvider],
};

export { checkAgentAction, verifyTrackRecordAction, searchProvenAgentsAction, mizanTrustPolicyProvider };
export { MizanClient } from "./vendor/mizan-agent-tools";
export default mizanPlugin;
