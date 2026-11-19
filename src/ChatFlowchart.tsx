import { useEffect, useRef, useState } from "react";
let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

export default function ChatFlowchart({ source }: { source: string }) {
  const [image, setImage] = useState("");
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState(300);
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setSpace(entry.contentRect.width));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [image]);
  useEffect(() => {
    let cancelled = false;
    setImage(""); setError(false);
    // Mermaid uses shared configuration and a temporary measuring element. Serialize renders,
    // then display an inert SVG image rather than inserting model-generated SVG into the app DOM.
    queue = queue.catch(() => {}).then(async () => {
      if (cancelled) return;
      const { default: mermaid } = await import("mermaid");
      if (cancelled) return;
      const measuring = document.createElement("div");
      measuring.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none";
      document.body.append(measuring);
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: false,
          theme: "default", maxTextSize: 12000, maxEdges: 100, suppressErrorRendering: true,
          flowchart: { htmlLabels: false, useMaxWidth: false } });
        const result = await mermaid.render(`folio-flow-${++counter}`, source, measuring);
        if (!cancelled) {
          const root = new DOMParser().parseFromString(result.svg, "image/svg+xml").documentElement;
          const bounds = root.getAttribute("viewBox")?.split(/[ ,]+/).map(Number);
          setRatio(bounds && bounds[2] > 0 && bounds[3] > 0 ? bounds[2] / bounds[3] : 1);
          setImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`);
        }
      } catch { if (!cancelled) setError(true); }
      finally { measuring.remove(); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [source]);
  return <>
    <div className="visual-toolbar"><strong>Flowchart</strong><div className="visual-actions">
      <button type="button" aria-label="Zoom in flowchart" onClick={() => setZoom(old => Math.min(4, old + 0.25))}>+</button>
      <button type="button" aria-label="Zoom out flowchart" onClick={() => setZoom(old => Math.max(0.5, old - 0.25))}>−</button>
      <button type="button" onClick={() => setZoom(1)}>Fit</button><span>{Math.round(zoom * 100)}%</span>
    </div></div>
    {error ? <p className="visual-status" role="status">Couldn't draw this flowchart. Check the Mermaid source below.</p>
      : image ? <div ref={viewport} className="chat-flowchart" tabIndex={0} aria-label="Flowchart (scroll to pan)">
        <img src={image} alt="Flowchart" draggable={false} style={{ width: Math.max(1, Math.min(space, 440 * ratio)) * zoom }} />
      </div> : <p className="visual-status">Drawing flowchart…</p>}
  </>;
}
