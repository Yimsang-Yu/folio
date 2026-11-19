import { _electron as electron } from "playwright-core";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { electronPath } from "./electron-path.mjs";
import { readerPage } from "./reader-page.mjs";
import { checkAiLayout } from "./smoke-ai-layout.mjs";
const root = path.resolve(import.meta.dirname, "..");
const shots = path.join(root, "release", "ai-layout");
mkdirSync(shots, { recursive: true });
const env = { ...process.env, FOLIO_TEST_USER_DATA: mkdtempSync(path.join(tmpdir(), "folio-ai-layout-")), FOLIO_TEST_HIDDEN: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ executablePath: electronPath(env), args: [root, "--mute-audio"], env, timeout: 60000 });
try {
  const page = readerPage(await app.firstWindow());
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.getByRole("button", { name: /Try a sample/ }).click();
  await page.locator(".textLayer span:not(.markedContent)").first().waitFor();
  await checkAiLayout(app, page, shots);
  await page.reload();
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await page.locator(".ai-panel table").first().waitFor();
  assert.equal(await page.locator(".ai-panel table").count(), 2);
  assert.equal(Math.round((await page.locator(".ai-panel").boundingBox()).width), 380);
  assert.deepEqual(errors, []);
  console.log("PASS: AI layout end-to-end checks, including history and width after reload");
} finally { await app.close(); }
