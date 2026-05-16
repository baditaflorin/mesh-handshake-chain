import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-handshake-chain",
  description: "Pairwise scan handshakes — find the longest unbroken contact chain in the room",
  accentHex: "#22d3ee",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
