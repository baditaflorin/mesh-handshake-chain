import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

async function payloadOf(page: import("@playwright/test").Page): Promise<string> {
  await page.locator(".mesh-qrx-payload summary").click();
  return (await page.locator(".mesh-qrx-payload code").textContent()) ?? "";
}

async function handshakeFrom(
  scanner: import("@playwright/test").Page,
  payload: string,
): Promise<void> {
  await scanner.getByPlaceholder("or paste a payload (URL or mesh://)").fill(payload);
  await scanner.getByRole("button", { name: "use", exact: true }).click();
}

test("paste-based handshake: chain length grows, both peers see longest chain of 2", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    await handshakeFrom(b, await payloadOf(a));

    await expect(a.locator(".viral-status")).toContainText("longest chain: 2");
    await expect(b.locator(".hsc-node")).toContainText(["alice"]);
  } finally {
    await cleanup();
  }
});

// The advertised value is "find the LONGEST UNBROKEN contact chain" — a single
// edge (chain of 2) never exercises the multi-hop graph walk. Three peers do
// A<->B and B<->C handshakes; longestSimplePath must traverse A-B-C and ALL
// THREE peers (including C, who never directly touched A) must converge on
// "longest chain: 3" with alice visible in the rendered path on every screen.
test("three-peer chain: A-B-C traverses to longest chain of 3 on every peer", async ({
  browser,
  baseURL,
}) => {
  const roomId = `e2e-${Math.random().toString(36).slice(2, 8)}`;
  const { context, a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", {
    storagePrefix,
    roomId,
  });
  // Third peer joins the SAME room/context (init script already pinned room id).
  const c = await context.newPage();
  await c.goto(baseURL ?? "");
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await c.getByPlaceholder("your name").fill("carol");

    // B scans A's QR (edge A-B), then C scans B's QR (edge B-C).
    await handshakeFrom(b, await payloadOf(a));
    await handshakeFrom(c, await payloadOf(b));

    // longestSimplePath must walk the 3-node path on EVERY peer.
    await expect(a.locator(".viral-status")).toContainText("longest chain: 3");
    await expect(b.locator(".viral-status")).toContainText("longest chain: 3");
    await expect(c.locator(".viral-status")).toContainText("longest chain: 3");

    // Carol's screen (the far end) must render alice in the chain even though
    // carol only ever handshook bob — proves multi-hop propagation + naming.
    await expect(c.locator(".hsc-node")).toContainText(["alice"]);
  } finally {
    await cleanup();
  }
});
