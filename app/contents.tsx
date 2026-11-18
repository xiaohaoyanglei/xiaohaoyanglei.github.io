"use client";

import { useEffect, useState } from "react";

// A paper-style table of contents in the right margin. It stays out of the way
// on the title page and appears once the reader scrolls on (together with the
// author card on screens wide enough for it).

type Chapter = { id: string; number: string; label: string };

export function useActiveChapter(chapters: readonly Chapter[]) {
  const [active, setActive] = useState<string>(chapters[0]?.id ?? "");
  const [pastTitle, setPastTitle] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = chapters[0]?.id ?? "";
      for (const { id } of chapters) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
      const title = document.getElementById("title");
      setPastTitle(title ? title.getBoundingClientRect().bottom < 0 : window.scrollY > 300);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [chapters]);

  return { active, pastTitle };
}

export default function Contents({ chapters }: { chapters: readonly Chapter[] }) {
  const { active, pastTitle } = useActiveChapter(chapters);
  const sections = chapters.filter((chapter) => chapter.number);
  return (
    <nav className={`contents${pastTitle ? " is-visible" : ""}`} aria-label="Contents">
      <p className="contents-title">Contents</p>
      <ol>
        {sections.map((chapter) => (
          <li key={chapter.id}>
            <a href={`#${chapter.id}`} aria-current={active === chapter.id ? "location" : undefined}>
              <span className="contents-number">{chapter.number}</span>
              {chapter.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
