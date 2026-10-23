"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ANALYTICS_URL } from "./visitor-map-config";
import { MAP_HEIGHT, MAP_WIDTH } from "./visitor-map-projection";
import { clusterVisitorLocations } from "./visitor-map-clusters";
import { loadVisitorStatistics } from "./visitor-map-client";
import type { DetectedLocation, VisitorStats } from "./visitor-map-data";
import "./visitor-map.css";

type Status = "loading" | "ready" | "error" | "unconfigured";

function shouldRecordVisit(): boolean {
  const hostname = window.location.hostname;
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)$/.test(hostname) || hostname.endsWith(".localhost");
  return !local || new URLSearchParams(window.location.search).get("visitor-test") === "1";
}

function countryName(code: string | null, stats: VisitorStats | null): string {
  if (!code || code === "XX") return "Unknown location";
  const supplied = stats?.countries.find((country) => country.code === code)?.name;
  if (supplied) return supplied;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; }
  catch { return code; }
}

function locationName(location: DetectedLocation, stats: VisitorStats | null): string {
  return [...new Set([location.city, location.region, countryName(location.country, stats)].filter(Boolean))].join(", ");
}

function readableDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

const formatCount = (count: number) => new Intl.NumberFormat("en").format(count);

export default function VisitorMap() {
  const [status, setStatus] = useState<Status>(ANALYTICS_URL ? "loading" : "unconfigured");
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [detected, setDetected] = useState<DetectedLocation | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const hoverCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipOffsetRef = useRef(0);
  const [tooltipOffset, setTooltipOffset] = useState(0);
  const [mapLayout, setMapLayout] = useState({ width: MAP_WIDTH });

  function cancelHoverClose() {
    if (hoverCloseRef.current !== null) clearTimeout(hoverCloseRef.current);
    hoverCloseRef.current = null;
  }

  useEffect(() => () => cancelHoverClose(), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => setMapLayout({
      width: map.getBoundingClientRect().width,
    });
    const observer = new ResizeObserver(update);
    observer.observe(map);
    window.addEventListener("resize", update);
    update();
    return () => { observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => {
    const base = ANALYTICS_URL.trim().replace(/\/+$/, "");
    if (!base) return;
    let disposed = false;
    const load = loadVisitorStatistics(base, shouldRecordVisit());
    load.then((result) => {
      if (disposed) return;
      setStats(result.stats);
      setDetected(result.detectedLocation);
      setStatus("ready");
    }).catch(() => { if (!disposed) setStatus("error"); });
    return () => { disposed = true; };
  }, [attempt]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setAttempt((value) => value + 1);
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", restore);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", restore);
    };
  }, []);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest(".visitor-marker")) setSelectedId(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  const activeId = hoveredId ?? selectedId;
  // A just-recorded visit can be milliseconds ahead of the visitor's clock.
  // Advance with wall time while never labelling that newest visit as old.
  const referenceTime = Math.max(Date.now(), Date.parse(stats?.updatedAt ?? "") || 0);
  const points = useMemo(() => clusterVisitorLocations(stats?.locations ?? [], mapLayout.width), [stats, mapLayout]);
  useEffect(() => {
    const ids = new Set(points.map((point) => point.id));
    setHoveredId((id) => id && ids.has(id) ? id : null);
    setSelectedId((id) => id && ids.has(id) ? id : null);
  }, [points]);
  useLayoutEffect(() => {
    const reposition = () => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const headerBottom = document.querySelector(".site-header-shell")?.getBoundingClientRect().bottom ?? 0;
      const topLimit = Math.max(12, headerBottom + 10);
      const marker = mapRef.current?.querySelector(".visitor-marker.is-active")?.getBoundingClientRect();
      if (marker && (marker.bottom < topLimit || marker.top > window.innerHeight)) {
        setHoveredId(null);
        setSelectedId(null);
        return;
      }
      const rect = tooltip.getBoundingClientRect();
      const naturalTop = rect.top - tooltipOffsetRef.current;
      const top = Math.max(topLimit, Math.min(naturalTop, window.innerHeight - rect.height - 12));
      const offset = top - naturalTop;
      tooltipOffsetRef.current = offset;
      setTooltipOffset(offset);
    };
    reposition();
    window.addEventListener("scroll", reposition, true);
    return () => window.removeEventListener("scroll", reposition, true);
  }, [activeId, points]);
  const started = readableDate(stats?.startedAt ?? null);
  const countryCount = stats?.countries.filter((country) => country.views > 0).length ?? 0;

  function retry() {
    setStatus("loading");
    setAttempt((value) => value + 1);
  }

  return (
    <section className="visitor-section" id="visitors" aria-labelledby="visitors-title">
      <div className="visitor-heading">
        <p className="section-index">07 / Visitors</p>
        <h2 id="visitors-title">Visitors around the world</h2>
        <p>A record of visits to this academic homepage.</p>
      </div>

      <div className="visitor-summary" aria-label="Visitor statistics" aria-busy={status === "loading"}>
        <div className="visitor-metric visitor-metric-total"><strong>{stats ? formatCount(stats.total) : "—"}</strong><span>Total page views</span></div>
        <div className="visitor-metric"><strong>{stats ? formatCount(countryCount) : "—"}</strong><span>Countries / regions</span></div>
        <div className="visitor-metric"><strong>{stats ? formatCount(stats.unknown) : "—"}</strong><span>Unknown location</span></div>
      </div>

      <div className="visitor-map-frame" data-map-status={status}>
        <div ref={mapRef} className="visitor-world" role="group" aria-label="Approximate locations of visits" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}
          onPointerUp={(event) => {
            // Small dots remain distinct. A tap just beside one selects the
            // nearest dot without adding overlapping invisible hit rectangles.
            if (event.pointerType !== "touch" || (event.target instanceof Element && event.target.closest(".visitor-marker"))) return;
            const rect = event.currentTarget.getBoundingClientRect();
            let nearest: string | null = null;
            let distance = 18;
            for (const point of points) {
              const next = Math.hypot(event.clientX - rect.left - point.x / MAP_WIDTH * rect.width, event.clientY - rect.top - point.y / MAP_HEIGHT * rect.height);
              if (next < distance) { distance = next; nearest = point.id; }
            }
            setHoveredId(null);
            setSelectedId(nearest);
          }}>
          {/* The public-domain land layer and every marker use the same Miller projection. */}
          <img className="visitor-world-land" src="/world-land-dots.svg" width={MAP_WIDTH} height={MAP_HEIGHT} alt="Dotted world map" draggable={false} />
          {points.map((location) => {
            const active = activeId === location.id;
            const lastSeen = location.lastSeen ? Date.parse(location.lastSeen) : Number.NaN;
            const age = referenceTime - lastSeen;
            const recent = Number.isFinite(age) && age >= 0 && age <= 24 * 60 * 60 * 1000;
            const grouped = location.locations.length > 1;
            const label = grouped ? `${location.locations.length} nearby locations` : locationName(location.locations[0], stats);
            const breakdown = location.locations.map((entry) => `${locationName(entry, stats)}: ${formatCount(entry.views)}`).join("; ");
            const horizontal = location.x < MAP_WIDTH * 0.25 ? "start" : location.x > MAP_WIDTH * 0.75 ? "end" : "center";
            const below = location.y < MAP_HEIGHT * 0.25;
            return (
              <button
                key={location.id}
                className={`visitor-marker${grouped ? " is-grouped" : ""}${recent ? " is-recent" : ""}${active ? " is-active" : ""}`}
                style={{ left: `${location.x / MAP_WIDTH * 100}%`, top: `${location.y / MAP_HEIGHT * 100}%`, width: location.diameter, height: location.diameter }}
                type="button"
                aria-label={`${label}: ${formatCount(location.views)} ${location.views === 1 ? "page view" : "page views"}.${grouped ? ` ${breakdown}.` : ""} Approximate location.`}
                aria-expanded={active}
                onPointerEnter={(event) => {
                  if (event.pointerType === "touch") return;
                  cancelHoverClose();
                  setHoveredId(location.id);
                }}
                onPointerLeave={() => {
                  cancelHoverClose();
                  // Give the pointer time to cross the curved edge into the
                  // detail panel without enlarging the circle's hit area.
                  hoverCloseRef.current = setTimeout(() => {
                    setHoveredId((id) => id === location.id ? null : id);
                    hoverCloseRef.current = null;
                  }, 160);
                }}
                onFocus={() => { cancelHoverClose(); setHoveredId(null); setSelectedId(location.id); }}
                onBlur={() => setSelectedId((id) => id === location.id ? null : id)}
                onClick={() => setSelectedId(location.id)}
                onKeyDown={(event) => { if (event.key === "Escape") { cancelHoverClose(); setSelectedId(null); setHoveredId(null); } }}
              >
                <svg className="visitor-marker-dot" aria-hidden="true" focusable="false" viewBox={`0 0 ${location.diameter} ${location.diameter}`}>
                  <circle cx={location.diameter / 2} cy={location.diameter / 2} r={(location.diameter - (grouped ? 2 : 1)) / 2} strokeWidth={grouped ? 2 : 1} />
                </svg>
                {active && <span ref={tooltipRef} style={{ translate: `0 ${tooltipOffset}px` }} className={`visitor-tooltip visitor-tooltip-${horizontal}${below ? " visitor-tooltip-below" : ""}${grouped ? " visitor-tooltip-group" : ""}`} role="tooltip">
                  <strong>{label}</strong><span>{formatCount(location.views)} {location.views === 1 ? "page view" : "page views"}{grouped ? " in total" : ""}</span>
                  {grouped && <span className="visitor-tooltip-locations">{location.locations.map((entry) => <span className="visitor-tooltip-location" key={entry.id}><span>{locationName(entry, stats)}</span><b>{formatCount(entry.views)}</b></span>)}</span>}
                  <small>Approximate location{grouped ? "s · Page views by location" : ""}</small>
                </span>}
              </button>
            );
          })}
        </div>
        <div className="visitor-map-feedback" role="status" aria-live="polite">
          {status === "loading" && <p>Loading visitor statistics…</p>}
          {status === "unconfigured" && <p>Visitor statistics will appear here once tracking is connected.</p>}
          {status === "error" && <p>Visitor statistics are temporarily unavailable. <button className="visitor-retry" type="button" onClick={retry}>Try again</button></p>}
          {status === "ready" && stats?.total === 0 && <p>No visits recorded yet. The map will fill as readers arrive.</p>}
          {status === "ready" && stats && stats.total > 0 && points.length === 0 && <p>Visits are recorded below. Detailed locations are not available yet.</p>}
        </div>
      </div>

      <div className="visitor-map-details">
        <div className="visitor-map-legend" aria-label="Map legend">
          <span><i className="visitor-dot visitor-dot-past" aria-hidden="true" />Earlier visits</span>
          <span><i className="visitor-dot visitor-dot-recent" aria-hidden="true" />Visited in the last 24 hours</span>
          <span>Point size reflects page views</span>
        </div>
        {detected?.country && <p className="visitor-detected">Your approximate location: <strong>{locationName(detected, stats)}</strong></p>}
      </div>

      {stats?.locationsTruncated && <p className="visitor-map-note visitor-map-limit">{formatCount(stats.locationCount)} locations have been recorded. The map shows at most 200; the country totals below include all visits.</p>}

      <details className="visitor-regions">
        <summary>Regional statistics <span aria-hidden="true">+</span></summary>
        {stats ? <div className="visitor-region-content">
          {stats.countries.length || stats.unknown > 0 ? <table>
            <caption className="sr-only">Page views by country or region</caption>
            <thead><tr><th scope="col">Country / region</th><th scope="col">Page views</th></tr></thead>
            <tbody>{stats.countries.filter((country) => country.views > 0).map((country) => <tr key={country.code}><th scope="row">{countryName(country.code, stats)}</th><td>{formatCount(country.views)}</td></tr>)}
              {stats.unknown > 0 && <tr><th scope="row">Unknown location</th><td>{formatCount(stats.unknown)}</td></tr>}
            </tbody>
          </table> : <p>No regional visits have been recorded yet.</p>}
        </div> : <p className="visitor-region-empty">{status === "loading" ? "Loading regional statistics…" : "Regional statistics are not available yet."}</p>}
      </details>

      <p className="visitor-map-note">Hover, focus, or tap a point for local page views. Overlapping dots share a point with separate counts. Totals include repeat visits and visits without a detailed location; locations are approximate.</p>
      <p className="visitor-map-note visitor-map-credit">Statistics hosted on Cloudflare.{started ? ` New statistics began ${started}.` : " A new record begins with this migration."} Map data: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth<span className="sr-only"> (opens in a new tab)</span></a>.</p>
      <noscript><p className="visitor-map-note">Enable JavaScript to load live visitor counts. The map background is available without it.</p></noscript>
    </section>
  );
}
