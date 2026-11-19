import assert from "node:assert/strict";
import path from "node:path";

export async function checkAiVisuals(app, page, shots) {
  const bar = { type: "bar", title: "治疗组比较", xLabel: "随访", yLabel: "数值", labels: ["1月", "2月", "3月", "4月"],
    series: [{ name: "治疗组", values: [10, 20, 30, 40] }, { name: "对照组", values: [15, 25, 20, 35] }] };
  const fence = (kind, source) => "```" + kind + "\n" + source + "\n```";
  const response = [
    "下面是示例数据图表，仅用于界面测试。",
    fence("chart", JSON.stringify(bar)),
    fence("mermaid", 'flowchart TD\n A[研究问题] --> B{符合纳入条件?}\n B --> C[纳入研究]\n B --> D[排除研究]'),
    fence("chart", JSON.stringify({ ...bar, type: "line", title: "趋势" })),
    fence("chart", JSON.stringify({ type: "scatter", title: "散点", series: [{ name: "数据", values: [[1, 3], [2, 5], [3, 4]] }] })),
    fence("chart", JSON.stringify({ type: "pie", title: "构成", labels: ["A", "B", "C"], series: [{ name: "比例", values: [10, 20, 30] }] })),
    fence("chart", '{"type":"bar","labels":["A"],"series":[{"values":["bad"]}]}'),
    fence("mermaid", 'flowchart TD\n A[Incomplete'),
    fence("mermaid", 'flowchart TD\n click A "https://example.test/tracker"'),
  ].join("\n\n");
  await app.evaluate(({ ipcMain, BrowserWindow }, reply) => {
    for (const channel of ["folio:ai-status", "folio:ai-ask"]) ipcMain.removeHandler(channel);
    ipcMain.handle("folio:ai-status", () => ({ chatgpt: { connected: false, welcomeSeen: true }, claude: { installed: true, loggedIn: true, subscription: true } }));
    ipcMain.handle("folio:ai-ask", (_event, request) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      globalThis.folioVisualFinish = () => contents.send("folio:ai-event", { id: request.id, type: "done" });
      contents.send("folio:ai-event", { id: request.id, type: "delta", text: reply.slice(0, 80) });
      setTimeout(() => contents.send("folio:ai-event", { id: request.id, type: "delta", text: reply.slice(80) }), 50);
      return true;
    });
  }, response);
  await page.evaluate(() => localStorage.setItem("folio:ai-provider", "claude"));
  const panel = page.getByRole("complementary", { name: "Ask AI" });
  if (await panel.count()) await panel.getByRole("button", { name: "Close Ask AI" }).click();
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await panel.getByRole("textbox").fill("请展示交互图表和流程图。");
  await panel.getByRole("textbox").press("Enter");
  const answer = panel.locator(".msg.assistant").last();
  await answer.getByText("The chart will appear when the answer finishes.").first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".msg.assistant:last-child .ai-visual").length === 8);
  assert.equal(await answer.locator("canvas").count(), 0, "incomplete output started a chart renderer");
  await app.evaluate(() => globalThis.folioVisualFinish());
  await answer.locator(".chat-chart canvas").nth(3).waitFor();
  const diagram = answer.locator(".chat-flowchart img");
  await diagram.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.chat-flowchart img')].every(img => img.complete && img.naturalWidth > 0));
  await answer.getByText(/Couldn't draw this flowchart/).waitFor();
  await answer.getByText(/Use finite numbers/).waitFor();
  await answer.getByText(/without HTML, links/).waitFor();
  assert.equal(await answer.locator(".chat-chart").count(), 4);
  assert.equal(await answer.locator(".chat-flowchart").count(), 1);
  assert.equal(await answer.locator(".ai-visual svg").count(), 0, "diagram SVG was inserted into the chat DOM");
  // Sections have accessible names; use the component boundary to keep this compatible with all browsers.
  const chart = answer.locator(".ai-visual").first();
  await chart.scrollIntoViewIfNeeded();
  const canvas = chart.locator("canvas");
  const before = await canvas.evaluate(el => el.toDataURL());
  const legend = chart.getByRole("button", { name: "治疗组", exact: true });
  await legend.click();
  assert.equal(await legend.getAttribute("aria-pressed"), "false");
  await page.waitForTimeout(150);
  assert.notEqual(await canvas.evaluate(el => el.toDataURL()), before, "legend toggle did not change the chart");
  await legend.click();
  assert.equal(await legend.getAttribute("aria-pressed"), "true");
  await chart.getByRole("button", { name: "Zoom in chart" }).click();
  await chart.getByText("70% range", { exact: true }).waitFor();
  await chart.getByRole("button", { name: "Reset zoom" }).click();
  await chart.getByText("100% range", { exact: true }).waitFor();
  const box = await canvas.boundingBox();
  for (let x = 65; x < box.width - 20; x += 18) {
    await page.mouse.move(box.x + x, box.y + 190);
    if ((await chart.locator(".chart-hover").innerText()).includes("组")) break;
  }
  assert.match(await chart.locator(".chart-hover").innerText(), /组.*\d/, "hover did not show a point value");
  const flow = answer.locator(".ai-visual").nth(1);
  const initialWidth = await diagram.evaluate(el => el.getBoundingClientRect().width);
  await flow.getByRole("button", { name: "Zoom in flowchart" }).click();
  assert.ok(await diagram.evaluate(el => el.getBoundingClientRect().width) > initialWidth);
  await flow.getByRole("button", { name: "Fit", exact: true }).click();
  assert.equal(await diagram.evaluate(el => el.getBoundingClientRect().width), initialWidth);
  await chart.locator("summary").click();
  assert.match(await chart.locator("pre").innerText(), /"type":"bar"/);
  await chart.locator("summary").click();

  const separator = panel.getByRole("separator", { name: "Resize Ask AI panel" });
  await separator.focus();
  await separator.press("End");
  await page.waitForTimeout(250);
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await chart.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "ai-interactive-chart-dark.png") });
  await flow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "ai-flowchart.png") });
  await separator.focus();
  await separator.press("Home");
  await page.waitForTimeout(250);
  assert.ok(await panel.evaluate(el => el.querySelector(".ai-body").scrollWidth <= el.querySelector(".ai-body").clientWidth + 1));
  assert.ok(await canvas.evaluate(el => el.getBoundingClientRect().width <= el.closest(".ai-panel").clientWidth));
  // Hover and pointer dragging have no colored stripe or outline.
  const handle = await separator.boundingBox();
  await page.mouse.move(handle.x + 4, handle.y + 80);
  await page.mouse.down();
  await page.mouse.move(handle.x - 70, handle.y + 80);
  assert.deepEqual(await separator.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, outline: getComputedStyle(el).outlineStyle })),
    { background: "rgba(0, 0, 0, 0)", outline: "none" });
  await page.mouse.up();
  await separator.dblclick();
  await panel.getByRole("button", { name: "Close Ask AI" }).click();
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await panel.locator(".chat-chart canvas").nth(3).waitFor();
  await panel.locator(".chat-flowchart img").waitFor();
  assert.ok(await page.locator(".brand-mark").evaluate(el => getComputedStyle(el).backgroundImage.includes("app-icon.png")));
  await panel.getByRole("button", { name: "Close Ask AI" }).click();
  console.log("ok  four chart types, hover values, legend toggles, zoom/reset, Mermaid image zoom, source, invalid/streaming output, reflow, reopening, neutral resize handle and app icon");
}
