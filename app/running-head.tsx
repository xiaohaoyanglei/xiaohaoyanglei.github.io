"use client";

import ChapterScrubber from "./chapter-scrubber";
import { useActiveChapter } from "./contents";
import LocalClock from "./local-clock";
import MobileNavigation from "./mobile-navigation";
import MoonMark from "./moon-mark";
import PageCounter from "./page-counter";

// Journal-style running head. On the title page it shows only tonight's moon;
// past the title it adds the author and the current section, like the header
// line on every page after the first.
//
// On wide screens it reaches into the margins, like the header of a printed
// paper: on the left, above the author card, tonight's moon with the time in
// Melbourne; on the right, above the contents, the page number. The card then
// carries the name, so the head leaves it out.

type Chapter = { id: string; number: string; label: string };

export default function RunningHead({
  chapters,
  name,
  city,
  timeZone,
}: {
  chapters: readonly Chapter[];
  name: string;
  city: string;
  timeZone: string;
}) {
  const { active, pastTitle } = useActiveChapter(chapters);
  const current = chapters.find((chapter) => chapter.id === active);
  return (
    <header className={`running-head${pastTitle ? " is-past-title" : ""}`}>
      <div className="running-head-inner">
        <div className="running-head-start">
          <a className="running-head-mark" href="#about" aria-label={`${name}, back to the top`}>
            <MoonMark city={city} size={22} />
            <span className="running-head-name" aria-hidden="true">
              {name}
            </span>
          </a>
          <p className="running-head-clock">
            <span className="sr-only">Local time in </span>
            {city}{" "}
            <LocalClock timeZone={timeZone} />
          </p>
        </div>
        <span className="running-head-section" aria-hidden="true">
          {current?.number ? (
            <>
              <span>{current.number}</span>
              {current.label}
            </>
          ) : null}
        </span>
        <PageCounter />
        <MobileNavigation />
      </div>
      <ChapterScrubber chapters={chapters} />
    </header>
  );
}
