"use client";

import { useState } from "react";

const buttonClass =
  "inline-flex h-9 items-center rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:border-zinc-400";

export function ShareButtons({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState<"link" | "markdown" | "error" | null>(null);

  async function copy(kind: "link" | "markdown") {
    try {
      await navigator.clipboard.writeText(kind === "link" ? window.location.href : markdown);
      setCopied(kind);
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => copy("link")} className={buttonClass} data-testid="copy-link">
        Copy link
      </button>
      <button type="button" onClick={() => copy("markdown")} className={buttonClass} data-testid="copy-markdown">
        Copy as Markdown
      </button>
      <span aria-live="polite" className="text-xs text-zinc-500">
        {copied === "link" && "Link copied"}
        {copied === "markdown" && "Markdown copied"}
        {copied === "error" && "Clipboard unavailable"}
      </span>
    </div>
  );
}
