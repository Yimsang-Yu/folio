import { Children, isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { normalizeMathDelimiters } from "./chatMath";
import { AiVisual } from "./AiVisual";
import "katex/dist/katex.min.css";

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  url?: string;
  data?: { hProperties: { "data-folio-page": string } };
}

// Transform only prose text, so page references never alter code, maths or links.
function remarkPageReferences() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children || ["link", "linkReference", "code", "inlineCode", "math", "inlineMath"].includes(node.type)) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== "text" || !child.value) { visit(child); return [child]; }
        const parts: MarkdownNode[] = [];
        const pattern = /\((?:p|pp|page|pages)\.?\s*(\d+)(?:[–-]\d+)?\)/gi;
        let last = 0;
        for (const match of child.value.matchAll(pattern)) {
          if (match.index! > last) parts.push({ type: "text", value: child.value.slice(last, match.index) });
          parts.push({ type: "link", url: `#folio-page-${match[1]}`, data: { hProperties: { "data-folio-page": match[1] } }, children: [{ type: "text", value: match[0] }] });
          last = match.index! + match[0].length;
        }
        if (last < child.value.length) parts.push({ type: "text", value: child.value.slice(last) });
        return parts;
      });
    };
    visit(tree);
  };
}

export const AiMarkdown = memo(function AiMarkdown({ text, onPage, streaming = false }: { text: string; onPage: (n: number) => void; streaming?: boolean }) {
  return (
    <ReactMarkdown
      skipHtml
      disallowedElements={["img"]}
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }], remarkPageReferences, remarkBreaks]}
      rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore", maxExpand: 1000, maxSize: 20 }]]}
      components={{
        pre: ({ children }) => {
          const code = Children.toArray(children)[0];
          if (isValidElement<{ className?: string; children?: ReactNode }>(code)) {
            const language = code.props.className?.replace(/^language-/, "");
            if ((language === "chart" || language === "mermaid") && typeof code.props.children === "string") {
              return <AiVisual kind={language} source={code.props.children.trimEnd()} streaming={streaming} />;
            }
          }
          return <pre>{children}</pre>;
        },
        table: ({ children }) => (
          <div className="ai-table-scroll" role="region" aria-label="Table (scroll horizontally for more columns)" tabIndex={0}>
            <table>{children}</table>
          </div>
        ),
        a: ({ node, children }) => {
          const page = Number(node?.properties["data-folio-page"]);
          return Number.isSafeInteger(page) && page > 0
            ? <button className="page-ref" onClick={() => onPage(page)} title={`Go to page ${page}`}>{children}</button>
            : <>{children}</>;
        },
      }}
    >
      {normalizeMathDelimiters(text)}
    </ReactMarkdown>
  );
});
