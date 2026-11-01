"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./icons";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some embedded webviews: fall back to a hidden textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

export default function CopyButton({
  text,
  label,
  className = "copy-button",
  showText = false,
}: {
  text: string;
  label: string;
  className?: string;
  showText?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={className}
      data-copied={copied || undefined}
      onClick={async () => {
        if (!(await copyText(text))) return;
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      <span className={showText ? undefined : "sr-only"}>{copied ? "Copied" : label}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? `${label}: copied to clipboard` : ""}
      </span>
    </button>
  );
}
