import { useLayoutEffect, useRef, useState, type ReactNode, type HTMLAttributes } from "react";
import { readSetting, writeSetting } from "./preferences";

const WIDTH_KEY = "folio:ai-panel-width";
const DEFAULT_WIDTH = 380;
const MAX_WIDTH = 1000;

export function AiPanelFrame({ children, ...handlers }: { children: ReactNode } & Pick<HTMLAttributes<HTMLElement>, "onDropCapture" | "onDragOver" | "onPasteCapture">) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const [preferred, setPreferred] = useState(() => {
    const saved = Number(readSetting(WIDTH_KEY));
    return Number.isFinite(saved) && saved >= 300 ? Math.min(saved, MAX_WIDTH) : DEFAULT_WIDTH;
  });
  const [maximum, setMaximum] = useState(MAX_WIDTH);
  const minimum = Math.min(300, maximum);
  const width = Math.max(minimum, Math.min(preferred, maximum));
  const resize = (value: number) => {
    const next = Math.round(Math.max(minimum, Math.min(value, maximum)));
    setPreferred(next);
    writeSetting(WIDTH_KEY, String(next));
  };

  useLayoutEffect(() => {
    const el = panel.current!;
    const parent = el.parentElement!;
    const stage = parent.querySelector<HTMLElement>(".stage");
    const measure = () => {
      // Narrow windows use the existing overlay. Otherwise leave room to read the PDF,
      // including when the navigation or version-history sidebar is open.
      const available = window.innerWidth <= 900 || !stage
        ? parent.clientWidth
        : stage.getBoundingClientRect().width + el.getBoundingClientRect().width - 280;
      setMaximum(Math.max(1, Math.min(MAX_WIDTH, Math.floor(available))));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    if (stage) observer.observe(stage);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  return <aside {...handlers} ref={panel} className="ai-panel" aria-label="Ask AI" style={{ width }}>
    <div className="ai-resize-handle" role="separator" tabIndex={0}
      aria-label="Resize Ask AI panel" aria-orientation="vertical"
      aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      title="Drag to resize · Double-click to reset"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointer: event.pointerId, x: event.clientX, width };
      }}
      onPointerMove={event => {
        if (drag.current?.pointer === event.pointerId) resize(drag.current.width + drag.current.x - event.clientX);
      }}
      onPointerUp={event => {
        if (drag.current?.pointer !== event.pointerId) return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onDoubleClick={() => resize(DEFAULT_WIDTH)}
      onKeyDown={event => {
        const step = event.shiftKey ? 50 : 20;
        const next = { ArrowLeft: width + step, ArrowRight: width - step, Home: minimum, End: maximum }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        resize(next);
      }} />
    {children}
  </aside>;
}
