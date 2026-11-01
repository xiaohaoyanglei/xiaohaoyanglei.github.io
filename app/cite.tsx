import type { Publication } from "./content";

// An in-text citation like "[2]". Hover or keyboard focus shows the reference,
// the way citation previews work in modern paper readers; clicking jumps to it.

export default function Cite({ paper, number }: { paper: Publication; number: number }) {
  const tipId = `cite-${paper.id}-${number}`;
  return (
    <span className="cite">
      <a href={`#pub-${paper.id}`} aria-describedby={tipId}>
        [{number}]
      </a>
      <span className="cite-pop" role="tooltip" id={tipId}>
        <span className="cite-pop-title">{paper.title}</span>
        <span className="cite-pop-venue">
          {paper.venueShort}
        </span>
      </span>
    </span>
  );
}
