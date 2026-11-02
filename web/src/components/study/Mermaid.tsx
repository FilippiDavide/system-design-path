"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Fallback renderer for chapters whose diagrams have not been redrawn
 * yet. Mermaid is loaded lazily on the client and themed flat
 * black-on-white so it does not clash with the custom diagrams.
 */
export function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "var(--font-jetbrains), monospace",
          themeVariables: {
            primaryColor: "#ffffff",
            primaryTextColor: "#0a0a0a",
            primaryBorderColor: "#0a0a0a",
            lineColor: "#0a0a0a",
            secondaryColor: "#f4f4f2",
            tertiaryColor: "#ffffff",
            fontSize: "13px",
          },
          flowchart: { curve: "linear", htmlLabels: true },
          mindmap: { padding: 8 },
        });
        const { svg } = await mermaid.render(`m${id}`, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (err) {
        console.error("mermaid render failed", err);
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="text-xs whitespace-pre-wrap border border-line-soft p-3">{code}</pre>
    );
  }
  return (
    <div className="mermaid-fallback overflow-x-auto py-2" ref={ref} aria-busy="true" />
  );
}
