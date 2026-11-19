import { describe, expect, it } from "vitest";
import { parseChart, checkFlowchart } from "./chatVisualSpec";
const chart = { type: "line", labels: ["A", "B"], series: [{ name: "Group", values: [10, 20] }] };
describe("AI chart data", () => {
  it("supports the four chart types and keeps missing line values", () => {
    for (const type of ["line", "bar", "pie"]) expect(parseChart(JSON.stringify({ ...chart, type })).type).toBe(type);
    expect(parseChart(JSON.stringify({ ...chart, series: [{ values: [null, 2] }] })).series[0].values).toEqual([null, 2]);
    expect(parseChart(JSON.stringify({ type: "scatter", series: [{ values: [[1, 2], [3, 4]] }] })).series[0].values).toEqual([[1, 2], [3, 4]]);
  });
  it("does not pass model-supplied executable options or resources into the renderer", () => {
    const result = parseChart(JSON.stringify({ ...chart, tooltip: { formatter: "alert(1)" }, backgroundColor: "https://example.test/pixel", series: [{ ...chart.series[0], symbol: "image://https://example.test/pixel" }] }));
    expect(result).not.toHaveProperty("tooltip");
    expect(result).not.toHaveProperty("backgroundColor");
    expect(result.series[0]).not.toHaveProperty("symbol");
  });
  it.each([
    null, [], {}, { ...chart, type: "custom" }, { ...chart, labels: ["A"] },
    { ...chart, series: [{ values: ["1", 2] }] }, { ...chart, series: [{ values: [1e99, 2] }] },
    { ...chart, type: "pie", series: [{ values: [-1, 2] }] },
    { ...chart, type: "pie", labels: ["A", "A"] },
    { ...chart, series: [chart.series[0], chart.series[0]] },
    { type: "scatter", series: [{ values: [[1, "2"]] }] },
    { ...chart, series: Array(13).fill(chart.series[0]) },
    { ...chart, labels: Array(501).fill("A") },
  ])("rejects malformed or oversized data: %j", value => {
    expect(() => parseChart(JSON.stringify(value))).toThrow();
  });
  it("rejects incomplete JSON and oversized source", () => {
    expect(() => parseChart('{"type":')).toThrow();
    expect(() => parseChart(" ".repeat(100001))).toThrow();
  });
});
describe("AI flowchart source", () => {
  it("accepts plain Chinese flowcharts with decisions and subgraphs", () => {
    const source = 'flowchart TD\n A[研究问题] --> B{符合条件?}\n B --> C[纳入]\n B --> D[排除]';
    expect(checkFlowchart(source)).toBe(source);
  });
  it.each([
    '%%{init:{"securityLevel":"loose"}}%%\nflowchart TD\n A-->B',
    'flowchart TD\n A["<img src=x>"]',
    'flowchart TD\n click A "https://example.test"',
    'flowchart TD\n A@{ img: "https://example.test" }',
    'flowchart TD\n style A fill:url(https://example.test)',
    '---\nconfig: {}\n---\nflowchart TD\nA-->B',
    'sequenceDiagram\n A->>B: Hello',
  ])("rejects non-flowcharts and active customization: %s", source => {
    expect(() => checkFlowchart(source)).toThrow();
  });
});
