"use client";

import { useEffect, useState } from "react";

// "p. 3 of 8": the page you would be on if this paper were printed one screen
// to a page, set in the running head like a journal's page number. It is
// decorative (the scrubber shows the same progress), so screen readers skip it.

type Page = { current: number; total: number };

export default function PageCounter() {
  const [page, setPage] = useState<Page | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight;
      const view = Math.max(1, window.innerHeight);
      const total = Math.max(1, Math.ceil(height / view - 0.05));
      const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, height - view)));
      const current = Math.min(total, Math.floor(progress * total) + 1);
      setPage((old) => (old && old.current === current && old.total === total ? old : { current, total }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <p className="running-head-page" aria-hidden="true">
      {page ? (
        <>
          <i>p.</i>
          <span>{page.current}</span>
          <i>of</i>
          <span>{page.total}</span>
        </>
      ) : null}
    </p>
  );
}
