"use client";

import { useEffect, useRef, useState } from "react";
import "./visitor-map.css";

// Public embed identifier generated in the owner's MapMyVisitors account.
// This is not an account credential. Counts are supplied only by the provider.
const MAP_SOURCE = "https://mapmyvisitors.com/map.js?cl=d6d3ca&w=a&t=tt&d=f3a8gatX0Q8s22M7C1hLf65Yhlpkf7smeKU3NCIpNRc&co=fbf9f4&cmo=1b55e7&cmn=b88942&ct=11110f";
const STATS_URL = "https://mapmyvisitors.com/web/1c918";

export default function VisitorMap() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let observer: MutationObserver | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let resizeFrame = 0;

    type ProviderMap = { updateSize?: () => void; remove?: () => void; onResize?: () => void };
    const provider = () => (window as Window & {
      vmap_jq?: (element: Element | Window) => {
        data: (name: string) => ProviderMap | undefined;
        off: (name: string, callback: () => void) => void;
      };
    }).vmap_jq;

    const getMap = () => {
      const mapElement = container.querySelector(".jvectormap-container");
      const jq = provider();
      return mapElement && jq ? jq(mapElement).data("mapObject") : undefined;
    };

    const fitMap = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (disposed) return;
        const width = container.clientWidth;
        const mapElement = container.querySelector<HTMLElement>(".mapmyvisitors-map");
        if (width <= 0 || !mapElement) return;
        // Explicit pixel height is necessary for the provider's older jQuery:
        // percentage children of an auto/aspect-ratio height can be read as zero.
        mapElement.style.height = `${width / 2.04}px`;
        // Resize the existing map, never re-install tracking on viewport changes.
        getMap()?.updateSize?.();
      });
    };

    // Deferring one tick avoids duplicate installation during React Strict Mode's
    // setup/cleanup cycle. No local counter or synthetic visitor locations exist.
    const install = setTimeout(() => {
      if (disposed) return;
      const script = document.createElement("script");
      script.id = "mapmyvisitors";
      script.src = MAP_SOURCE;
      script.async = true;
      script.onerror = () => { if (!disposed) setStatus("unavailable"); };

      const check = () => {
        const count = container.querySelector(".mapmyvisitors-visitors")?.textContent ?? "";
        const rendered = container.querySelector("svg, canvas");
        if (rendered && /\d/.test(count)) {
          if (!disposed) setStatus("ready");
          if (timeout) clearTimeout(timeout);
          const map = getMap();
          const jq = provider();
          // Our observer waits for positive layout dimensions before resizing.
          if (map?.onResize && jq) jq(window).off("resize", map.onResize);
          const mapLink = container.querySelector<HTMLAnchorElement>("#mapmyvisitors-widget");
          if (mapLink) {
            mapLink.href = STATS_URL;
            mapLink.target = "_blank";
            mapLink.rel = "noopener noreferrer";
            mapLink.setAttribute("aria-label", "Visitor map and total page views. Open regional statistics in a new tab.");
          }
          fitMap();
        }
      };
      observer = new MutationObserver(check);
      observer.observe(container, { childList: true, subtree: true, characterData: true });
      timeout = setTimeout(() => {
        if (!disposed) setStatus("unavailable");
      }, 20000);
      resizeObserver = new ResizeObserver(fitMap);
      resizeObserver.observe(container);
      container.appendChild(script);
    }, 0);

    return () => {
      disposed = true;
      clearTimeout(install);
      if (timeout) clearTimeout(timeout);
      observer?.disconnect();
      resizeObserver?.disconnect();
      cancelAnimationFrame(resizeFrame);
      getMap()?.remove?.();
      container.replaceChildren();
    };
  }, []);

  return (
    <section className="section visitor-section" id="visitors" aria-labelledby="visitors-title">
      <div className="visitor-heading">
        <p className="section-index">07 / Visitors</p>
        <h2 id="visitors-title">Visitors around the world</h2>
        <p>A record of visits to this academic homepage.</p>
      </div>
      <div className="visitor-map-frame" data-map-status={status}>
        <div className="visitor-map-host" ref={host} role="group" aria-label="World map of visits with total page views" />
        {status !== "ready" && (
          <p className="visitor-map-status" role="status">
            {status === "loading" ? "Loading visitor map…" : "The visitor map is temporarily unavailable. You can still open the regional statistics below."}
          </p>
        )}
      </div>
      <div className="visitor-map-details">
        <div className="visitor-map-legend" aria-label="Map legend">
          <span><i className="visitor-dot visitor-dot-past" aria-hidden="true" />Past visits</span>
          <span><i className="visitor-dot visitor-dot-recent" aria-hidden="true" />Recent visits</span>
        </div>
        <a className="text-link" href={STATS_URL} target="_blank" rel="noreferrer">
          Regional statistics <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p className="visitor-map-note">
        Hover over a point to see visits from that location. Counts include repeat page views; locations are approximate.
        <span> Statistics by <a href={STATS_URL} target="_blank" rel="noreferrer">MapMyVisitors<span className="sr-only"> (opens in a new tab)</span></a>.</span>
      </p>
      <noscript><p className="visitor-map-note">Enable JavaScript to view the live map, or open the regional statistics.</p></noscript>
    </section>
  );
}
