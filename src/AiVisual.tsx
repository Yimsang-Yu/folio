import { Component, lazy, Suspense, useMemo, type ReactNode } from "react";
import { checkFlowchart, parseChart } from "./chatVisualSpec";
const Chart = lazy(() => import("./ChatChart"));
const Flowchart = lazy(() => import("./ChatFlowchart"));

class VisualBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="visual-status" role="status">Couldn't load this diagram. Its source is still available below.</p> : this.props.children;
  }
}

export function AiVisual({ kind, source, streaming }: { kind: "chart" | "mermaid"; source: string; streaming: boolean }) {
  const parsed = useMemo(() => {
    if (streaming) return {};
    try { return kind === "chart" ? { chart: parseChart(source) } : { flow: checkFlowchart(source) }; }
    catch (error) { return { error: error instanceof SyntaxError ? "The chart data is not valid JSON." : (error as Error).message }; }
  }, [kind, source, streaming]);
  return <section className="ai-visual" aria-label={kind === "chart" ? "Interactive chart" : "Flowchart"}>
    {streaming ? <p className="visual-status">The {kind === "chart" ? "chart" : "flowchart"} will appear when the answer finishes.</p>
      : parsed.error ? <p className="visual-status" role="status">Couldn't display this {kind === "chart" ? "chart" : "flowchart"}. {parsed.error}</p>
      : <VisualBoundary key={source}><Suspense fallback={<p className="visual-status">Loading diagram…</p>}>
        {parsed.chart ? <Chart spec={parsed.chart} /> : <Flowchart source={parsed.flow!} />}
      </Suspense></VisualBoundary>}
    <details className="visual-source" open={parsed.error ? true : undefined}>
      <summary>View source</summary><pre><code>{source}</code></pre>
    </details>
  </section>;
}
