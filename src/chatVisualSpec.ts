export type ChartSpec = {
  type: "line" | "bar" | "scatter" | "pie";
  title: string;
  xLabel: string;
  yLabel: string;
  labels: string[];
  series: { name: string; values: (number | null | [number, number])[] }[];
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const label = (value: unknown, fallback = ""): string => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.length > 200) throw new Error("Labels must be text of at most 200 characters.");
  return value;
};
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e15;

// Build the chart from a small data-only format, never arbitrary model-supplied options or JavaScript.
export function parseChart(source: string): ChartSpec {
  if (source.length > 100_000) throw new Error("This chart is too large to display.");
  const value: unknown = JSON.parse(source);
  if (!record(value) || !["line", "bar", "scatter", "pie"].includes(String(value.type))) throw new Error("Use a line, bar, scatter or pie chart.");
  const type = value.type as ChartSpec["type"];
  const labels = value.labels === undefined ? [] : value.labels;
  if (!Array.isArray(labels) || labels.length > 500) throw new Error("Use at most 500 labels.");
  const names = labels.map(item => label(item));
  if (type !== "scatter" && names.length === 0) throw new Error("This chart needs labels.");
  if (!Array.isArray(value.series) || value.series.length < 1 || value.series.length > 12) throw new Error("Use 1–12 data series.");
  const series = value.series.map((entry, index) => {
    if (!record(entry) || !Array.isArray(entry.values) || entry.values.length < 1 || entry.values.length > 500) throw new Error("Each series needs 1–500 values.");
    if (type !== "scatter" && entry.values.length !== names.length) throw new Error("Each series must have one value per label.");
    const values = entry.values.map(item => {
      if (type === "scatter") {
        if (!Array.isArray(item) || item.length !== 2 || !item.every(number)) throw new Error("Scatter values must be [x, y] number pairs.");
        return [item[0], item[1]] as [number, number];
      }
      if (item === null && type !== "pie") return null;
      if (!number(item) || (type === "pie" && item < 0)) throw new Error("Use finite numbers; pie values must be non-negative.");
      return item;
    });
    return { name: label(entry.name, `Series ${index + 1}`), values };
  });
  if (new Set(series.map(item => item.name)).size !== series.length) throw new Error("Series names must be unique.");
  if (type === "pie" && (series.length !== 1 || new Set(names).size !== names.length)) throw new Error("Pie charts need one series and unique labels.");
  return { type, title: label(value.title, "Chart"), xLabel: label(value.xLabel), yLabel: label(value.yLabel), labels: names, series };
}

export function checkFlowchart(source: string): string {
  if (source.length > 12_000) throw new Error("This flowchart is too large to display.");
  if (!/^\s*(flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/.test(source)) throw new Error("Start the flowchart with flowchart TD or flowchart LR.");
  if (/%%\s*\{|@\s*\{|[<>]|\b(?:click|style|classDef|linkStyle)\b/i.test(source.replace(/-->|==>|-\.->|<--/g, ""))) {
    throw new Error("Use plain nodes and arrows, without HTML, links, images or custom styles.");
  }
  return source;
}
