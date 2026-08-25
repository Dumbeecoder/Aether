"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyableValue({ value, display }: { value: string; display?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — fail
      // quietly rather than throwing in a display component.
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      {display ?? value}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        className="rounded p-0.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
