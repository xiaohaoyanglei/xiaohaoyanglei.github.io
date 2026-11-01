"use client";

import { useState } from "react";
import CopyButton from "./copy-button";

export default function Bibtex({ id, entry }: { id: string; entry: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `bibtex-${id}`;
  return (
    <>
      <button
        type="button"
        className="small-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        BibTeX
      </button>
      <div className="bibtex" id={panelId} hidden={!open}>
        <pre>
          <code>{entry}</code>
        </pre>
        <CopyButton text={entry} label="Copy BibTeX" className="bibtex-copy" showText />
      </div>
    </>
  );
}
