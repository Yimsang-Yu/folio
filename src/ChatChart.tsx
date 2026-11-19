import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ChartSpec } from "./chatVisualSpec";
echarts.use([BarChart, LineChart, PieChart, ScatterChart, AriaComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
const colors = ["#3689c9", "#e28a39", "#42a789", "#9868c5", "#db6478", "#7e963b"];

export default function ChatChart({ spec }: { spec: ChartSpec }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.EChartsType | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [range, setRange] = useState([0, 100]);
  const rangeRef = useRef(range);
  const [hover, setHover] = useState("");
  const [error, setError] = useState(false);
  const names = spec.type === "pie" ? spec.labels : spec.series.map(item => item.name);
  useEffect(() => {
    const el = container.current!;
    const instance = echarts.init(el, undefined, { renderer: "canvas" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    instance.on("mouseover", (params: unknown) => {
      const data = params as { seriesName?: string; name?: string; value?: unknown };
      if (data.value !== undefined) setHover([data.seriesName, data.name, String(data.value)].filter(Boolean).join(" · "));
    });
    instance.on("datazoom", () => {
      const zoom = (instance.getOption().dataZoom as { start: number; end: number }[])?.[0];
      if (zoom) { rangeRef.current = [zoom.start, zoom.end]; setRange(rangeRef.current); }
    });
    return () => { observer.disconnect(); instance.dispose(); chart.current = null; };
  }, []);
  useEffect(() => {
    const el = container.current!;
    const render = () => {
      const style = getComputedStyle(el);
      const text = style.getPropertyValue("--text").trim() || "#555";
      const line = style.getPropertyValue("--line").trim() || "#ddd";
      try {
        chart.current!.setOption({
          animation: false,
          color: colors,
          textStyle: { color: text, fontFamily: "system-ui, sans-serif" },
          aria: { enabled: true },
          tooltip: { trigger: "item", renderMode: "richText", confine: true },
          legend: { show: false, data: names, selected: Object.fromEntries(names.map(name => [name, !hidden.includes(name)])) },
          ...(spec.type === "pie" ? {} : {
            grid: { left: 55, right: 22, top: 35, bottom: 70, containLabel: true },
            xAxis: { type: spec.type === "scatter" ? "value" : "category", data: spec.labels,
              name: spec.xLabel, nameLocation: "middle", nameGap: 30, axisLabel: { color: text, hideOverlap: true, width: 90, overflow: "truncate" }, axisLine: { lineStyle: { color: line } } },
            yAxis: { type: "value", name: spec.yLabel, axisLabel: { color: text }, splitLine: { lineStyle: { color: line } } },
            dataZoom: [{ type: "slider", start: rangeRef.current[0], end: rangeRef.current[1], height: 18, bottom: 8, borderColor: line, textStyle: { color: text } },
              { type: "inside", zoomOnMouseWheel: "ctrl", moveOnMouseWheel: false }],
          }),
          series: spec.series.map(series => ({ type: spec.type, name: series.name,
            ...(spec.type === "pie" ? { radius: ["30%", "65%"], label: { color: text, overflow: "truncate", width: 100 },
              data: series.values.map((value, index) => ({ name: spec.labels[index], value })) }
              : { data: series.values, symbolSize: 9, emphasis: { focus: "series" } }),
          })),
        }, { notMerge: true });
        setError(false);
      } catch { setError(true); }
    };
    render();
    const theme = new MutationObserver(render);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => theme.disconnect();
    // Zoom is applied by ECharts itself; rebuilding on every slider event would interrupt dragging.
  }, [spec, hidden]);
  const zoom = (factor: number) => {
    const center = (range[0] + range[1]) / 2;
    const span = Math.max(5, Math.min(100, (range[1] - range[0]) * factor));
    const start = Math.max(0, Math.min(100 - span, center - span / 2));
    chart.current?.dispatchAction({ type: "dataZoom", start, end: start + span });
  };
  return <>
    <div className="visual-toolbar"><strong>{spec.title}</strong>
      {spec.type !== "pie" && <div className="visual-actions">
        <button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in chart">+</button>
        <button type="button" onClick={() => zoom(1 / 0.7)} aria-label="Zoom out chart">−</button>
        <button type="button" onClick={() => chart.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 })}>Reset zoom</button>
        <span className="visual-range" aria-live="polite">{Math.round(range[1] - range[0])}% range</span>
      </div>}
    </div>
    <div className="visual-legend" aria-label="Chart legend">
      {names.map((name, index) => <button key={name} type="button" aria-pressed={!hidden.includes(name)}
        onClick={() => { setHidden(old => old.includes(name) ? old.filter(item => item !== name) : [...old, name]); setHover(""); }}>
        <span style={{ background: colors[index % colors.length] }} />{name}
      </button>)}
    </div>
    {error && <p role="status">Couldn't draw this chart. You can still read its source below.</p>}
    <div ref={container} className="chat-chart" aria-label={spec.title} />
    <p className="chart-hover" aria-live="polite">{hover || "Hover over the chart to see a value."}</p>
  </>;
}
