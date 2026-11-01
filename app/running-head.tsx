"use client";

import ChapterScrubber from "./chapter-scrubber";
import { useActiveChapter } from "./contents";
import MobileNavigation from "./mobile-navigation";
import MoonMark from "./moon-mark";

// Journal-style running head. On the title page it shows only tonight's moon;
// past the title it adds the author and the current section, like the header
// line on every page after the first.

type Chapter = { id: string; number: string; label: string };

export default function RunningHead({
  chapters,
  name,
  city,
}: {
  chapters: readonly Chapter[];
  name: string;
  city: string;
}) {
  const { active, pastTitle } = useActiveChapter(chapters);
  const current = chapters.find((chapter) => chapter.id === active);
  return (
    <header className={`running-head${pastTitle ? " is-past-title" : ""}`}>
      <div className="running-head-inner">
        <a className="running-head-mark" href="#title" aria-label={`${name}, back to the title`}>
          <MoonMark city={city} size={22} />
          <span className="running-head-name" aria-hidden="true">
            {name}
          </span>
        </a>
        <span className="running-head-section" aria-hidden="true">
          {current?.number ? (
            <>
              <span>{current.number}</span>
              {current.label}
            </>
          ) : null}
        </span>
        <MobileNavigation />
      </div>
      <ChapterScrubber chapters={chapters} />
    </header>
  );
}
