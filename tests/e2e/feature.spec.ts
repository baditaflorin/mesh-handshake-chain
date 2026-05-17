import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("paste-based handshake: chain length grows, both peers see longest chain of 2", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");

    await a.locator(".mesh-qrx-payload summary").click();
    const payload = (await a.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await b.getByPlaceholder("or paste a payload (URL or mesh://)").fill(payload);
    await b.getByRole("button", { name: "use", exact: true }).click();

    await expect(a.locator(".viral-status")).toContainText("longest chain: 2");
    await expect(b.locator(".hsc-node")).toContainText(["alice"]);
  } finally {
    await cleanup();
  }
});
