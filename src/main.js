import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ==========================================================================
   1. LENIS — SMOOTH SCROLL INSTANCE
   No wrapper/content options: Lenis manages the window/documentElement
   scroll directly, which is the correct mode for a full-page scroll
   (wrapper/content mode scrolls an arbitrary INNER container instead,
   and requires that container to have explicit height + overflow CSS
   to do anything — unnecessary complexity when the whole page scrolls).
   No native `scroll` listener is ever attached — Lenis owns the scroll
   loop entirely.
   ========================================================================== */
const lenis = new Lenis({
  lerp: 0.1,
  smoothWheel: true,
  syncTouch: false,
});

/* ==========================================================================
   2. SYNCHRONISE LENIS WITH THE GSAP TICKER
   GSAP's ticker becomes the single requestAnimationFrame loop for the
   whole app. Lenis is driven BY that loop, and ScrollTrigger recalculates
   from Lenis's own scroll value on every tick. Nothing here touches
   window.addEventListener('scroll').
   ========================================================================== */
gsap.ticker.add((time) => {
  lenis.raf(time * 1000); // gsap.ticker time is in seconds; Lenis expects ms
});
gsap.ticker.lagSmoothing(0);

lenis.on("scroll", ScrollTrigger.update);

/* ==========================================================================
   3. CARD STACK — primary scroll mechanic
   HEADER_H / FOOTER_H / STAGE_GAP must match the values baked into the
   .stack-card height calc() in index.css (72px / 48px / 32px there).
   ========================================================================== */
const HEADER_H = 72;
const FOOTER_H = 48; // not used directly below — card height already reserves this in CSS; kept here as documentation of the pin budget
const STAGE_GAP = 32; // breathing room between the header and a card's resting top edge

// Px of each earlier card's top edge left visible, peeking above the
// one that stacks on top of it — the "fanned deck" look in the
// reference, rather than each card being fully hidden by the next.
const PEEK = 14;

/*
   Each .stack-card pins just below the header, offset by (its index *
   PEEK) so cards don't all stack flush — card 2 pins 14px lower than
   card 1, card 3 another 14px lower than that, and so on. That growing
   offset is what stays visible as a sliver of each earlier card peeking
   out above the incoming one, once the earlier card is scaled/dimmed
   below. pinSpacing: false means a pinned card does NOT reserve extra
   scroll room — the next card's normal document flow scrolls up and
   over it.

   The recede (scale + dim) animation is driven by THIS card's own pin
   progress (self.progress, 0→1 across its own "+=100%" active window)
   via onUpdate, rather than by a separate ScrollTrigger watching the
   next card's layout position. That second approach is the natural
   first instinct but it's layout-fragile: "next card's top reaches the
   viewport bottom" only lines up with "next card starts covering this
   one" when every card is exactly 100vh tall. The moment card height
   dropped below the viewport (to sit inset under the header/footer),
   cards' natural document-flow spacing got closer together than the
   viewport height, so that trigger's start condition was already
   satisfied before any scrolling happened — cards loaded pre-dimmed.
   Driving the recede off the pin's own progress sidesteps that: it's
   scroll-DISTANCE based, not dependent on any element's layout height.

   All animation here targets transform (scale) and filter (brightness)
   — never top/left/width/height — to stay on the compositor thread per
   the hardware-acceleration constraint.
   ========================================================================== */
function initCardStack() {
  const cards = gsap.utils.toArray(".stack-card");

  cards.forEach((card, i) => {
    const pinOffset = HEADER_H + STAGE_GAP + i * PEEK;
    const hasNext = Boolean(cards[i + 1]);

    // Later cards must paint over earlier ones once both are pinned —
    // position: fixed elements don't reliably respect DOM order for
    // stacking, so z-index is set explicitly.
    card.style.zIndex = String(10 + i);

    ScrollTrigger.create({
      trigger: card,
      start: `top ${pinOffset}`,
      end: () => (hasNext ? "+=100%" : "+=0"),
      pin: true,
      pinSpacing: false,
      anticipatePin: 1,
      onUpdate: (self) => {
        if (!hasNext) return; // last card never recedes — it simply ends the sequence
        const p = self.progress;
        gsap.set(card, {
          scale: gsap.utils.interpolate(1, 0.94, p),
          filter: `brightness(${gsap.utils.interpolate(1, 0.6, p)})`,
        });
      },
    });
  });
}

/* ==========================================================================
   4. CUSTOM CURSOR — quickSetter only
   gsap.quickSetter writes directly to the transform property with no
   tween/timeline object churn on every mousemove.
   ========================================================================== */
function initCursor() {
  const cursor = document.getElementById("cursor");
  if (!cursor) return;

  const setX = gsap.quickSetter(cursor, "x", "px");
  const setY = gsap.quickSetter(cursor, "y", "px");

  window.addEventListener(
    "mousemove",
    (e) => {
      setX(e.clientX);
      setY(e.clientY);
    },
    { passive: true }
  );
}

/* ==========================================================================
   5. INTRO OVERLAY — full-page takeover on load
   A fixed, full-viewport layer (z-index 500, above the header/footer
   bars and the entire stack) covers the whole site on load. Lines
   cycle one bright/rest dim, then the overlay fades out as a unit to
   reveal the real site underneath — nothing on the page itself needs
   its own hidden/reveal state, since the overlay already hides it.
   Runs on a plain GSAP timeline (not tied to scroll) — it's a one-time
   load animation, not part of the scroll mechanic above.
   ========================================================================== */
let introTimeline = null;

function playIntro(overlay, delay = 0.3) {
  const lines = overlay.querySelectorAll(".intro-line");

  if (introTimeline) introTimeline.kill();

  // Reset to the pre-play state every time this runs (including a
  // replay, not just first load) — overlay visible, every line back
  // to its dim resting opacity, pointer events re-enabled so it
  // actually blocks interaction with the page under it again.
  gsap.set(overlay, { opacity: 1, pointerEvents: "auto", display: "flex" });
  gsap.set(lines, { opacity: 0.22 });

  const HOLD = 0.85; // seconds each line stays "active" before the next brightens

  const tl = gsap.timeline({ delay });
  introTimeline = tl;

  lines.forEach((line, i) => {
    tl.to(line, { opacity: 1, duration: 0.4, ease: "power2.out" }, i === 0 ? 0 : `+=${HOLD}`);
    if (i > 0) {
      tl.to(lines[i - 1], { opacity: 0.22, duration: 0.4, ease: "power2.out" }, "<");
    }
  });

  // Hold on the final line a beat longer, then fade the whole overlay
  // out to reveal the real site. pointerEvents/display:none at the end
  // so the (now invisible) overlay stops intercepting clicks/scroll.
  tl.to(overlay, { opacity: 0, duration: 0.6, ease: "power2.inOut" }, `+=${HOLD}`);
  tl.set(overlay, { pointerEvents: "none", display: "none" });
}

function initIntroSequence() {
  const overlay = document.getElementById("intro-overlay");
  if (!overlay) return;

  playIntro(overlay, 0.3);

  // Replay affordance: click the brand mark to watch the intro again
  // without reloading the page. Temporary/dev convenience while this
  // is still being reviewed — easy to drop later if it's not wanted
  // as a permanent feature.
  const mark = document.querySelector(".nav-mark");
  if (mark) {
    mark.addEventListener("click", () => playIntro(overlay, 0));
  }
}

/* ==========================================================================
   6. MENU PANEL
   Opened by the header's Menu button, closed by its own Close button,
   Escape, or clicking an item (items have no real destination yet —
   see the markup comment — so for now a click just closes the menu).
   Lenis is stopped/restarted while open so the page underneath can't
   scroll through the overlay. The accent dot follows the cursor with
   quickSetter (same technique as #cursor) and only shows while a row
   is actually hovered.
   ========================================================================== */
function initMenu() {
  const overlay = document.getElementById("menu-overlay");
  const trigger = document.getElementById("menu-trigger");
  const closeBtn = document.getElementById("menu-close");
  const dot = document.getElementById("menu-dot");
  if (!overlay || !trigger || !closeBtn) return;

  const items = overlay.querySelectorAll(".menu-item");
  let isOpen = false;
  let menuTl = null;

  const setDotX = dot ? gsap.quickSetter(dot, "x", "px") : null;
  const setDotY = dot ? gsap.quickSetter(dot, "y", "px") : null;

  function onMouseMove(e) {
    if (!setDotX || !setDotY) return;
    setDotX(e.clientX);
    setDotY(e.clientY);
  }

  function openMenu() {
    if (isOpen) return;
    isOpen = true;
    trigger.setAttribute("aria-expanded", "true");
    lenis.stop();

    if (menuTl) menuTl.kill();
    gsap.set(overlay, { pointerEvents: "auto" });
    menuTl = gsap.to(overlay, { opacity: 1, duration: 0.4, ease: "power2.out" });

    window.addEventListener("mousemove", onMouseMove, { passive: true });
  }

  function closeMenu() {
    if (!isOpen) return;
    isOpen = false;
    trigger.setAttribute("aria-expanded", "false");
    lenis.start();

    if (menuTl) menuTl.kill();
    menuTl = gsap.to(overlay, {
      opacity: 0,
      duration: 0.35,
      ease: "power2.inOut",
      onComplete: () => gsap.set(overlay, { pointerEvents: "none" }),
    });

    if (dot) gsap.set(dot, { opacity: 0 });
    window.removeEventListener("mousemove", onMouseMove);
  }

  trigger.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  items.forEach((item) => {
    item.addEventListener("click", (e) => {
      // Only the still-placeholder rows (marked data-menu-item, href="#")
      // get intercepted — About/Services have real hrefs now and should
      // navigate normally, not get swallowed into a menu-close.
      if (item.hasAttribute("data-menu-item")) {
        e.preventDefault();
        closeMenu();
      }
    });
    if (dot) {
      item.addEventListener("mouseenter", () => gsap.to(dot, { opacity: 1, duration: 0.2 }));
      item.addEventListener("mouseleave", () => gsap.to(dot, { opacity: 0, duration: 0.2 }));
    }
  });
}

/* ==========================================================================
   7. ENQUIRE POPOVER — regional contact routing
   Two placeholder contacts (Ryan for US/Americas, Harley for UK/
   Europe). Guesses the visitor's region from their browser timezone
   on load (America/* vs Europe/*, defaulting to US when the timezone
   doesn't clearly match either — most of this client base is US-
   based, and a wrong Europe guess is a worse first impression than a
   wrong US one) — that's ONLY a best-effort heuristic, not reliable
   for a visitor on a VPN or traveling, which is why the popover also
   lets them pick the other contact directly rather than hiding it.
   No real email/calendar is wired up yet (matches the rest of the
   site's placeholder nav) — this only decides which name/title shows.
   ========================================================================== */
function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.startsWith("Europe/")) return "uk";
    if (tz.startsWith("America/")) return "us";
  } catch (e) {
    // Intl not available for some reason — fall through to the default.
  }
  return "us";
}

function initEnquire() {
  const popover = document.getElementById("enquire-popover");
  const triggers = [
    document.getElementById("enquire-trigger"),
    document.getElementById("enquire-trigger-menu"),
  ].filter(Boolean);
  if (!popover || !triggers.length) return;

  const options = popover.querySelectorAll(".enquire-option");
  let selectedRegion = detectRegion();
  let isOpen = false;
  let popoverTl = null;

  function applySelection() {
    options.forEach((opt) => {
      opt.classList.toggle("is-selected", opt.dataset.region === selectedRegion);
    });
  }
  applySelection();

  function setExpanded(value) {
    triggers.forEach((t) => t.setAttribute("aria-expanded", String(value)));
  }

  function openPopover() {
    if (isOpen) return;
    isOpen = true;
    setExpanded(true);
    if (popoverTl) popoverTl.kill();
    gsap.set(popover, { pointerEvents: "auto" });
    popoverTl = gsap.to(popover, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" });
  }

  function closePopover() {
    if (!isOpen) return;
    isOpen = false;
    setExpanded(false);
    if (popoverTl) popoverTl.kill();
    popoverTl = gsap.to(popover, {
      opacity: 0,
      y: -6,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => gsap.set(popover, { pointerEvents: "none" }),
    });
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isOpen ? closePopover() : openPopover();
    });
  });

  options.forEach((opt) => {
    opt.addEventListener("click", () => {
      selectedRegion = opt.dataset.region;
      applySelection();
      closePopover();
    });
  });

  document.addEventListener("click", (e) => {
    if (isOpen && !popover.contains(e.target) && !triggers.includes(e.target)) {
      closePopover();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopover();
  });
}

/* ==========================================================================
   BOOT
   ========================================================================== */
function init() {
  initIntroSequence();
  initCardStack();
  initCursor();
  initMenu();
  initEnquire();
  ScrollTrigger.refresh();
}

init();
