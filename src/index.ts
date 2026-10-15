import type { Plugin } from "@elizaos/core";
import { searchProvenAgentsAction } from "./actions/searchProvenAgents";
import { verifyTrackRecordAction } from "./actions/verifyTrackRecord";
import { mizanTrustPolicyProvider } from "./providers/trustPolicy";

export const mizanPlugin: Plugin = {
  name: "mizan",
  description:
    "Verify MIZAN zero-knowledge track-record credentials before copying, paying or allocating to another agent's performance claim.",
  actions: [verifyTrackRecordAction, searchProvenAgentsAction],
  providers: [mizanTrustPolicyProvider],
};

export { verifyTrackRecordAction, searchProvenAgentsAction, mizanTrustPolicyProvider };
export { MizanClient } from "./vendor/mizan-agent-tools";
export default mizanPlugin;
