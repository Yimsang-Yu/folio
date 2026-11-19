import assert from "node:assert/strict";
import path from "node:path";

export async function checkAiLayout(app, page, shots) {
  const comparison = `有区别。两者都会利用分层信息进行调整，但**标准化先合并风险**，Mantel–Haenszel（M-H）方法则合并各层的效应量。

| | 标准化 | M-H 方法 |
|---|---|---|
| 基本做法 | 分别计算“全部接受治疗”和“全部不接受治疗”的加权平均风险，再比较 | 计算各层的风险比、优势比等，再按 M-H 权重合并 |
| 主要结果 | 指定目标人群的**总体效应**，也称边际效应 | 一个**合并的分层效应量**；当各层效应相近时，可解释为共同的分层效应 |
| 权重 | 通常使用目标人群中各层的比例 | 由各层的数据和所选效应量决定，不一定等于人群比例 |

书中将标准化和合并分层效应量区分开来 (p. 1)。`;
  const wide = `| A | B | C | D | E | F | G | H |\n|---|---|---|---|---|---|---|---|\n| ${Array(8).fill("LongUnbrokenIdentifier".repeat(6)).join(" | ")} |`;
  const reply = comparison + "\n\n" + wide + "\n\nInline math: \\(x_i\\).\n\n```\n" + "long_code_".repeat(50) + "\n```";
  await app.evaluate(({ ipcMain, BrowserWindow }, text) => {
    for (const channel of ["folio:ai-status", "folio:ai-ask"]) ipcMain.removeHandler(channel);
    ipcMain.handle("folio:ai-status", () => ({ chatgpt: { connected: false, welcomeSeen: true },
      claude: { installed: true, loggedIn: true, subscription: true } }));
    ipcMain.handle("folio:ai-ask", (_event, request) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      // Deliver separate partial tables through the real renderer event bridge.
      const parts = text.match(/[\s\S]{1,37}/g);
      parts.forEach((part, index) => setTimeout(() => contents.send("folio:ai-event", { id: request.id, type: "delta", text: part }), index * 10));
      setTimeout(() => contents.send("folio:ai-event", { id: request.id, type: "done" }), parts.length * 10 + 30);
      return true;
    });
  }, reply);
  await page.evaluate(() => localStorage.setItem("folio:ai-provider", "claude"));
  const setSize = async (width, height = 900) => {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [width, height]);
    await page.window.setViewportSize({ width, height });
    await page.waitForTimeout(350);
  };
  const panel = page.getByRole("complementary", { name: "Ask AI" });
  const open = () => page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await setSize(1440);
  await open();
  await panel.getByRole("textbox").fill("请用表格比较标准化和 M-H 方法。");
  await panel.getByRole("textbox").press("Enter");
  await panel.locator(".msg.assistant").last().getByRole("button", { name: "Copy response" }).waitFor();
  assert.equal(await panel.locator("table").count(), 2);
  assert.equal(await panel.locator("table").first().locator("th").count(), 3);
  assert.equal(await panel.locator("table").first().locator("td").count(), 9);
  assert.equal(await panel.locator(".katex").count(), 1);
  const separator = panel.getByRole("separator", { name: "Resize Ask AI panel" });
  const width = async () => Math.round((await panel.boundingBox()).width);
  const assertContained = async () => {
    const measures = await panel.evaluate(el => {
      const body = el.querySelector(".ai-body");
      const table = el.querySelector(".ai-table-scroll");
      const stage = el.parentElement.querySelector(".stage");
      return { panel: el.getBoundingClientRect().width, body: body.clientWidth, scroll: body.scrollWidth,
        table: table.clientWidth, tableScroll: table.scrollWidth, stage: stage.getBoundingClientRect().width,
        viewport: innerWidth };
    });
    assert.ok(measures.scroll <= measures.body + 1, JSON.stringify(measures));
    assert.ok(measures.panel <= measures.viewport, JSON.stringify(measures));
    if (measures.viewport > 900) assert.ok(measures.stage >= 279, JSON.stringify(measures));
  };
  await assertContained();
  const originalHeight = await panel.locator("table").first().evaluate(el => el.offsetHeight);
  const originalWidth = await width();
  const handle = await separator.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x - 260, handle.y + 100, { steps: 15 });
  await page.mouse.up();
  assert.ok(await width() > originalWidth + 200, "drag did not widen the panel");
  assert.ok(await panel.locator("table").first().evaluate(el => el.offsetHeight) < originalHeight, "table did not reflow at wider width");
  await assertContained();
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; document.querySelector(".ai-body").scrollTop = 0; });
  await page.screenshot({ path: path.join(shots, "ai-table-wide-dark.png") });
  const remembered = await width();
  await panel.getByRole("button", { name: "Close Ask AI" }).click();
  await open();
  assert.equal(await width(), remembered);
  await panel.locator("table").nth(1).waitFor();
  assert.equal(await panel.locator("table").count(), 2, "saved answer failed to render after reopening");
  await separator.focus();
  await separator.press("ArrowRight");
  assert.equal(await width(), remembered - 20);
  await separator.press("Home");
  assert.equal(await width(), 300);
  await assertContained();
  const overflow = panel.locator(".ai-table-scroll").last();
  assert.ok(await overflow.evaluate(el => el.scrollWidth > el.clientWidth), "wide tables should scroll locally");
  await overflow.focus();
  await overflow.press("ArrowRight");
  await page.waitForTimeout(150);
  assert.ok(await overflow.evaluate(el => el.scrollLeft > 0), "table is not keyboard scrollable");
  await separator.dblclick();
  assert.equal(await width(), 380);
  await separator.focus();
  await separator.press("End");
  await assertContained();
  const widePreference = await page.evaluate(() => localStorage.getItem("folio:ai-panel-width"));
  await setSize(1000);
  await assertContained();
  await setSize(600);
  await assertContained();
  await setSize(420, 740);
  await assertContained();
  assert.equal(await page.evaluate(() => localStorage.getItem("folio:ai-panel-width")), widePreference, "window shrinking overwrote preferred width");
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; document.querySelector(".ai-body").scrollTop = 0; });
  await page.screenshot({ path: path.join(shots, "ai-table-narrow-light.png") });
  await setSize(1440);
  assert.equal(await width(), Number(widePreference));
  await separator.dblclick();
  // Citations inside an answer still navigate the PDF after table parsing is enabled.
  await panel.getByRole("button", { name: "(p. 1)", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Page number"]')?.value === "1");
  await panel.getByRole("button", { name: "Close Ask AI" }).click();
  console.log("ok  streamed Chinese tables, math, citations, pointer/keyboard resizing, saved width, reflow and narrow windows");
}
