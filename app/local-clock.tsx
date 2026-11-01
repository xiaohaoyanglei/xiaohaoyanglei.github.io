"use client";

import { useEffect, useState } from "react";

/** The current time in a city, as plain inline text (e.g. "08:14"). */
export default function LocalClock({ timeZone }: { timeZone: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-AU", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const update = () => setTime(format.format(new Date()));
    update();
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, [timeZone]);

  return <time className="local-clock">{time ?? "--:--"}</time>;
}
