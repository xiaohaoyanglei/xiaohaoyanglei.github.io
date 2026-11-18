"use client";

import { useEffect, useRef } from "react";
import CopyButton from "./copy-button";
import ProfileLinks from "./profile-links";

// On wide screens, once the portrait slides under the running head, the
// portrait, email and links fly from the title page into this card in the left
// margin, which stays with the reader while the paper scrolls. Back at the top
// they fly home.
//
// Every item exists twice, on the title page (in flow) and in the card (fixed),
// paired by data-dock-item, and only one copy shows at rest. A transition
// measures where each item is drawn right now, mid-flight included, switches
// state, then animates the copy that should show from there to its own place
// (FLIP). So the motion can turn around at any moment. The email wraps
// differently in the card, so its two copies cross-fade while they travel.

const ITEMS = ["avatar", "email", "scholar", "github", "cv"] as const;
const CROSSFADE = new Set<string>(["email"]);
/** The portrait leaves first; the three buttons travel together so they never cross. */
const DELAY_MS: Record<string, number> = { avatar: 0, email: 40, scholar: 80, github: 80, cv: 80 };
const WIDE = "(min-width: 1240px)";
/** Share of the portrait hidden under the running head that docks / undocks it. */
const DOCK_AT = 0.35;
const UNDOCK_AT = 0.18;
const DOCK_MS = 700;
const UNDOCK_MS = 620;
const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";

type Mode = "fly" | "arrive" | "none";
type Pair = { name: string; hero: HTMLElement; card: HTMLElement };
/** translate(x, y) scale(s), with the transform origin at the top left. */
type Placement = { x: number; y: number; scale: number };

const HOME: Placement = { x: 0, y: 0, scale: 1 };

/** Placement that draws an element laid out at `box` over `to` (centres matched). */
function placeAt(box: DOMRect, to: DOMRect): Placement {
  const scale = box.width > 0 && box.height > 0 ? Math.sqrt((to.width * to.height) / (box.width * box.height)) : 1;
  return {
    x: to.left + to.width / 2 - (box.left + (box.width * scale) / 2),
    y: to.top + to.height / 2 - (box.top + (box.height * scale) / 2),
    scale,
  };
}

const css = ({ x, y, scale }: Placement) =>
  `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;

/** Quick start, long settle. */
const leadEase = (u: number) => 1 - (1 - u) ** 4;
/** Waits for the leading axis (until `start`), then follows smoothly. */
const followEase = (u: number, start: number) => {
  const s = Math.min(1, Math.max(0, (u - start) / (1 - start)));
  return s * s * (3 - 2 * s);
};

/**
 * Keyframes for a curved flight: one axis leads and the other follows, which
 * draws an arc instead of a straight line and keeps the buttons from crossing
 * as they regroup between one row and two.
 */
function flight(from: Placement, to: Placement, lead: "x" | "y", lag = 0.3, extra: Keyframe = {}): Keyframe[] {
  const steps = 24;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const u = i / steps;
    const ex = lead === "x" ? leadEase(u) : followEase(u, lag);
    const ey = lead === "y" ? leadEase(u) : followEase(u, lag);
    const es = (ex + ey) / 2;
    return {
      ...extra,
      offset: u,
      transform: css({
        x: from.x + (to.x - from.x) * ex,
        y: from.y + (to.y - from.y) * ey,
        scale: from.scale + (to.scale - from.scale) * es,
      }),
    };
  });
}

const opacityOf = (element: Element) => Number(getComputedStyle(element).opacity);

/** Current scale of an element's transform (1 when it has none). */
function zoomOf(element: Element | null) {
  if (!element) return 1;
  const transform = getComputedStyle(element).transform;
  return transform && transform !== "none" ? new DOMMatrixReadOnly(transform).a : 1;
}

const focusablesIn = (element: HTMLElement) =>
  [element, ...element.querySelectorAll<HTMLElement>("*")].filter((node) => node.matches("a[href], button"));

export default function ProfileDock({
  name,
  affiliation,
  email,
  portrait,
}: {
  name: string;
  affiliation: string;
  email: string;
  portrait: string;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [user, domain] = email.split("@");

  useEffect(() => {
    const card = cardRef.current;
    const hero = document.querySelector<HTMLElement>(".title-page");
    const slot = hero?.querySelector<HTMLElement>(".avatar-slot");
    const panel = card?.querySelector<HTMLElement>(".profile-card-panel");
    const head = document.querySelector<HTMLElement>(".running-head");
    if (!card || !hero || !slot || !panel) return;

    const root = document.documentElement;
    const wide = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pairs: Pair[] = ITEMS.flatMap((item) => {
      const inHero = hero.querySelector<HTMLElement>(`[data-dock-item="${item}"]`);
      const inCard = card.querySelector<HTMLElement>(`[data-dock-item="${item}"]`);
      return inHero && inCard ? [{ name: item, hero: inHero, card: inCard }] : [];
    });
    const extras = Array.from(card.querySelectorAll<HTMLElement>("[data-dock-extra]"));
    const heroMedia = hero.querySelector<HTMLElement>(".portrait-media");
    const cardMedia = card.querySelector<HTMLElement>(".profile-card-media");
    const heroCanvas = hero.querySelector<HTMLCanvasElement>(".portrait-canvas");
    const cardNoise = card.querySelector<HTMLCanvasElement>(".profile-card-noise");

    let docked = false;
    let running: Animation[] = [];
    let frame = 0;
    let first = true;

    const play = (element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      running.push(element.animate(keyframes, { easing: EASE, fill: "backwards", ...options }));
    };

    const setDocked = (next: boolean, mode: Mode) => {
      if (next === docked) return;

      // 1. Where everything is drawn right now (animations included).
      const shown = getComputedStyle(card).visibility === "visible";
      const seen = pairs.map(({ hero: inHero, card: inCard }) => ({
        hero: inHero.getBoundingClientRect(),
        card: inCard.getBoundingClientRect(),
        heroOpacity: opacityOf(inHero),
        cardOpacity: shown ? opacityOf(inCard) : 0,
      }));
      const zoom = { hero: zoomOf(heroMedia), card: zoomOf(cardMedia) };
      const panelOpacity = shown ? opacityOf(panel) : 0;
      const extraOpacity = extras.map((element) => (shown ? opacityOf(element) : 0));

      // Keyboard focus inside the card follows its item home.
      let refocus: HTMLElement | undefined;
      const active = document.activeElement;
      if (!next && active instanceof HTMLElement && card.contains(active)) {
        const pair = pairs.find(({ card: inCard }) => inCard.contains(active));
        if (pair) refocus = focusablesIn(pair.hero)[focusablesIn(pair.card).indexOf(active)];
      }

      // 2. Switch state; every element falls back to its resting style.
      running.forEach((animation) => animation.cancel());
      running = [];
      docked = next;
      if (next) root.dataset.dock = "docked";
      else delete root.dataset.dock;
      refocus?.focus({ preventScroll: true });
      if (mode === "none") return;

      // 3. Where everything rests in the new state.
      const rest = pairs.map(({ hero: inHero, card: inCard }) => ({
        hero: inHero.getBoundingClientRect(),
        card: inCard.getBoundingClientRect(),
      }));
      const cardZoom = zoomOf(cardMedia);
      const duration = next ? DOCK_MS : UNDOCK_MS;
      const total = duration + Math.max(...Object.values(DELAY_MS)) + 40;

      // Keep the card drawn for the whole transition, also on the way home.
      running.push(card.animate([{ visibility: "visible" }, { visibility: "visible" }], { duration: total }));

      if (mode === "arrive") {
        // Nothing on screen to fly from (a jump down the page): the card just arrives.
        [panel, ...pairs.map(({ card: inCard }) => inCard), ...extras].forEach((element, index) => {
          play(element, [{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], {
            duration: 440,
            delay: index * 26,
          });
        });
        return;
      }

      // 4. Fly each item from where it was seen to where it rests.
      pairs.forEach((pair, index) => {
        const target = next ? pair.card : pair.hero;
        const other = next ? pair.hero : pair.card;
        const targetRest = next ? rest[index].card : rest[index].hero;
        const otherRest = next ? rest[index].hero : rest[index].card;
        const targetSeen = next ? seen[index].card : seen[index].hero;
        const otherSeen = next ? seen[index].hero : seen[index].card;
        const targetOpacity = next ? seen[index].cardOpacity : seen[index].heroOpacity;
        const otherOpacity = next ? seen[index].heroOpacity : seen[index].cardOpacity;
        const fromOther = otherOpacity >= targetOpacity;
        const from = fromOther ? otherSeen : targetSeen;
        const delay = DELAY_MS[pair.name] ?? 0;
        // The portrait always slides sideways first. Into the card the buttons
        // first drop into their two rows and then slide; on the way home they
        // spread out sideways first and then merge into one row.
        const lead = pair.name === "avatar" || !next ? "x" : "y";
        // Into the card the portrait starts to drop as soon as it has cleared the name.
        const lag = pair.name === "avatar" && next ? 0.15 : 0.3;
        // On the way home the title-page copy passes over the fading card.
        const lift: Keyframe = next ? {} : { zIndex: 45 };

        play(target, flight(placeAt(targetRest, from), HOME, lead, lag, lift), { duration, delay, easing: "linear" });

        if (CROSSFADE.has(pair.name)) {
          play(
            target,
            [{ opacity: targetOpacity }, { opacity: targetOpacity, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 1 }],
            { duration, delay, easing: "linear" },
          );
          play(other, flight(placeAt(otherRest, otherSeen), placeAt(otherRest, targetRest), lead, lag), {
            duration,
            delay,
            easing: "linear",
          });
          // Faded-out copies hold at 0 until the card itself is hidden again.
          play(other, [{ opacity: otherOpacity }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], {
            duration,
            delay,
            easing: "linear",
            fill: "both",
          });
        } else {
          play(other, [{ opacity: 0 }, { opacity: 0 }], { duration: total, delay: 0 });
        }

        if (pair.name === "avatar") {
          // The card shows a closer crop: the photo zooms in on the way there.
          const zoomFrom = fromOther ? (next ? zoom.hero : zoom.card) : next ? zoom.card : zoom.hero;
          const media = next ? cardMedia : heroMedia;
          if (media) {
            play(media, [{ transform: `scale(${zoomFrom})` }, { transform: `scale(${next ? cardZoom : 1})` }], {
              duration,
              delay,
            });
          }
          // A portrait still being denoised finishes denoising on its way to the card.
          if (next && fromOther && heroCanvas?.dataset.status === "sampling" && cardNoise) {
            const context = cardNoise.getContext("2d");
            if (context) {
              context.clearRect(0, 0, cardNoise.width, cardNoise.height);
              context.drawImage(heroCanvas, 0, 0, cardNoise.width, cardNoise.height);
              play(cardNoise, [{ opacity: 1 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], {
                duration: duration + 200,
                delay,
                easing: "ease-out",
              });
            }
          }
        }
      });

      if (next) {
        play(panel, [{ opacity: panelOpacity, transform: "scale(0.965)" }, { opacity: 1, transform: "none" }], {
          duration: 500,
          delay: 70,
        });
        extras.forEach((element, index) => {
          play(element, [{ opacity: extraOpacity[index], transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
            duration: 460,
            delay: 200 + index * 45,
          });
        });
      } else {
        play(panel, [{ opacity: panelOpacity, transform: "none" }, { opacity: 0, transform: "scale(0.985)" }], {
          duration: 340,
          easing: "ease-in",
          fill: "both",
        });
        extras.forEach((element, index) => {
          play(element, [{ opacity: extraOpacity[index] }, { opacity: 0 }], {
            duration: 180,
            easing: "ease-out",
            fill: "both",
          });
        });
      }
    };

    /** A keyboard user is on a title-page item that is on screen: keep it visible. */
    const focusHeld = (headBottom: number) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !hero.contains(active)) return false;
      if (!active.closest("[data-dock-item]")) return false;
      try {
        if (!active.matches(":focus-visible")) return false;
      } catch {
        // Browsers without :focus-visible: treat any focus as keyboard focus.
      }
      const box = active.getBoundingClientRect();
      return box.bottom > headBottom && box.top < window.innerHeight;
    };

    const evaluate = () => {
      frame = 0;
      const initial = first;
      first = false;
      if (!wide.matches) {
        setDocked(false, "none");
        return;
      }
      const box = slot.getBoundingClientRect();
      const headBottom = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
      const hidden = box.height > 0 ? (headBottom - box.top) / box.height : 0;
      const held = focusHeld(headBottom);
      if (!docked && hidden > DOCK_AT && !held) {
        const lowest = pairs[pairs.length - 1]?.hero.getBoundingClientRect();
        const offscreen = !lowest || lowest.bottom < headBottom;
        setDocked(true, reduce.matches ? "none" : initial || offscreen ? "arrive" : "fly");
      } else if (docked && (hidden < UNDOCK_AT || held)) {
        setDocked(false, reduce.matches ? "none" : "fly");
      }
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(evaluate);
    };

    evaluate();
    const observer = new ResizeObserver(schedule);
    observer.observe(hero);
    // Resizing also covers crossing the 1240px breakpoint.
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      if (frame) cancelAnimationFrame(frame);
      running.forEach((animation) => animation.cancel());
      delete root.dataset.dock;
    };
  }, []);

  return (
    <aside className="profile-card" ref={cardRef} aria-label="About the author">
      <span className="profile-card-panel" aria-hidden="true" />
      <a className="profile-card-identity" href="#about">
        <span className="profile-card-avatar" data-dock-item="avatar">
          <span className="profile-card-media">
            <img src={portrait} alt="" width={760} height={950} decoding="async" />
            <canvas className="profile-card-noise" width={288} height={360} aria-hidden="true" />
          </span>
        </span>
        <span className="profile-card-name" data-dock-extra>
          {name}
          <sup aria-hidden="true">†</sup>
        </span>
        <span className="sr-only">, back to the top of the page</span>
      </a>
      <p className="profile-card-affiliation" data-dock-extra>
        {affiliation}
      </p>
      <span className="profile-card-rule" data-dock-extra aria-hidden="true" />
      <p className="profile-card-email">
        {/* Always two lines, so the copy button stays with the address at any card width. */}
        <span data-dock-item="email">
          <a href={`mailto:${email}`} aria-label={email}>
            {user}@
            <br />
            {domain}
          </a>
          <CopyButton text={email} label="Copy email address" />
        </span>
      </p>
      <ProfileLinks className="profile-card-links" />
      <p className="profile-card-note" data-dock-extra>
        <sup aria-hidden="true">†</sup>Corresponding author
      </p>
    </aside>
  );
}
