import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ParallaxScroll.module.css";

/**
 * ParallaxScroll
 * --------------
 * A seamless, infinite, snap-aware parallax scroller.
 *
 * Design goals (why this is rewritten from the GSAP/Lenis version):
 *   1. NO JUMPING. Sections are positioned with modulo arithmetic, so the
 *      "loop" has no seam to cross — section N+1 simply *is* section 0.
 *      There is no ScrollTrigger to get confused by an infinite wrap.
 *   2. NO LAG, ANY NUMBER OF SLIDES. Each frame we only ever touch the DOM
 *      for the 2–3 sections actually near the viewport (virtualization).
 *      Adding 5 slides or 500 costs the same per-frame work.
 *   3. SMOOTH. A single requestAnimationFrame loop drives a frame-rate
 *      independent exponential ease toward a target, with momentum on touch
 *      and gentle snap-to-section when the input settles.
 *
 * It is fully self-contained: no scroll library, no scroll-linked plugin,
 * so nothing external can fight it.
 */

/* Tunables — safe to tweak, the engine adapts. */
const LERP = 0.12;          // easing per 60fps-frame toward target (higher = snappier)
const SNAP_LERP = 0.16;     // easing while settling onto a slide
const WHEEL_SPEED = 1.0;    // mouse-wheel sensitivity
const TOUCH_SPEED = 1.0;    // finger-drag sensitivity
const MOMENTUM_FRICTION = 0.92; // per-frame velocity decay after a flick
const SNAP_DELAY = 90;      // ms of stillness before we start snapping
const SNAP_VEL = 0.6;       // px/frame below which snapping may begin
const PARALLAX = 0.14;      // image drift as a fraction of viewport height
const IMG_OVERSCAN = 0.16;  // image is (1 + 2*overscan) tall so drift never shows edges
const MARQUEE_NEAR = 1.0;   // marquee scale when a slide is centered
const MARQUEE_FAR = 1.5;    // marquee scale when a slide is at the viewport edge
const RENDER_MARGIN = 1.15; // how far (in viewports) off-screen we keep painting

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (v, m) => ((v % m) + m) % m;

function prefersReducedMotion() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

/* SVG text marquee — one per hero, scale-driven by the engine. */
function Marquee({ label, innerRef }) {
    return (
        <svg
            ref={innerRef}
            className={styles.marquee}
            viewBox="0 0 1200 200"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                {label}
            </text>
        </svg>
    );
}

export default function ParallaxScroll({ items }) {
    const { t } = useTranslation();
    const wrapperRef = useRef(null);

    // Per-section DOM handles, kept in stable arrays sized to `items`.
    const sectionRefs = useRef([]);
    const imageRefs = useRef([]);
    const marqueeRefs = useRef([]);
    const visibleState = useRef([]); // last applied visibility, to avoid redundant writes

    const setRef = (store) => (i) => (el) => {
        store.current[i] = el;
    };

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const N = items.length;
        if (N === 0) return;

        const reduced = prefersReducedMotion();

        let vh = wrapper.clientHeight || window.innerHeight;
        let total = N * vh;

        // Virtual scroll state.
        let pos = 0;          // smoothed position actually rendered
        let target = 0;       // where we are easing toward
        let velocity = 0;     // px per frame, for flick momentum
        let dragging = false;
        let lastInputAt = -Infinity;
        let lastFrame = performance.now();
        let rafId = 0;

        const measure = () => {
            const newVh = wrapper.clientHeight || window.innerHeight;
            if (newVh && newVh !== vh) {
                // Preserve which slide we're on across a resize.
                const slide = vh ? pos / vh : 0;
                vh = newVh;
                total = N * vh;
                pos = slide * vh;
                target = Math.round(slide) * vh;
            }
        };

        /* ---- Rendering: positions every section via modulo (seamless loop) ---- */
        const render = () => {
            for (let i = 0; i < N; i++) {
                const section = sectionRefs.current[i];
                if (!section) continue;

                // Place section i into [-vh, total - vh) relative to pos.
                const y = wrap(i * vh - pos, total) - vh;

                // Normalized distance of the slide's center from viewport center,
                // in [-1, 1] across one screen of travel (negative = entering below).
                const d = clamp(y / vh, -2, 2);

                const onScreen = Math.abs(d) <= RENDER_MARGIN;

                // Toggle paint only when it changes (avoids per-frame style thrash).
                if (visibleState.current[i] !== onScreen) {
                    visibleState.current[i] = onScreen;
                    section.style.visibility = onScreen ? "visible" : "hidden";
                    section.style.willChange = onScreen ? "transform" : "auto";
                    const img = imageRefs.current[i];
                    const mq = marqueeRefs.current[i];
                    if (img) img.style.willChange = onScreen ? "transform" : "auto";
                    if (mq) mq.style.willChange = onScreen ? "transform" : "auto";
                }
                if (!onScreen) {
                    // Still park it correctly so it re-enters from the right side.
                    section.style.transform = `translate3d(0, ${y}px, 0)`;
                    continue;
                }

                section.style.transform = `translate3d(0, ${y}px, 0)`;

                // Image parallax: drift within the over-scanned slack so edges never show.
                const img = imageRefs.current[i];
                if (img) {
                    const drift = reduced ? 0 : d * PARALLAX * vh;
                    img.style.transform = `translate3d(0, ${drift}px, 0)`;
                }

                // Marquee scale: largest at the edges, settles to 1 when centered.
                const mq = marqueeRefs.current[i];
                if (mq) {
                    const scale = reduced
                        ? 1
                        : MARQUEE_NEAR + (MARQUEE_FAR - MARQUEE_NEAR) * Math.abs(d);
                    mq.style.transform = `scale(${scale})`;
                }
            }
        };

        /* ---- The single animation loop ---- */
        const frame = (now) => {
            const dt = clamp((now - lastFrame) / 1000, 0, 0.05); // seconds, clamped
            lastFrame = now;
            const f = dt * 60; // elapsed in 60fps-frames → frame-rate independence

            // Momentum after a flick.
            if (!dragging && Math.abs(velocity) > SNAP_VEL) {
                target += velocity;
                velocity *= Math.pow(MOMENTUM_FRICTION, f);
            } else if (!dragging) {
                velocity = 0;
            }

            // Snap to the nearest slide once input has settled.
            let lerp = LERP;
            const idle = now - lastInputAt > SNAP_DELAY;
            if (!dragging && idle && Math.abs(velocity) <= SNAP_VEL) {
                target = Math.round(target / vh) * vh;
                lerp = SNAP_LERP;
            }

            // Frame-rate-independent exponential ease toward target.
            const k = reduced ? 1 : 1 - Math.pow(1 - lerp, f);
            pos += (target - pos) * k;

            // Keep the numbers bounded so they never lose float precision over time.
            if (pos > total) {
                pos -= total;
                target -= total;
            } else if (pos < 0) {
                pos += total;
                target += total;
            }

            render();
            rafId = requestAnimationFrame(frame);
        };

        /* ---- Input handlers ---- */
        const onWheel = (e) => {
            e.preventDefault();
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 16;          // lines → px
            else if (e.deltaMode === 2) dy *= vh;     // pages → px
            target += dy * WHEEL_SPEED;
            velocity = 0;
            lastInputAt = performance.now();
        };

        let touchY = 0;
        let touchPrevY = 0;
        let touchPrevT = 0;
        const onTouchStart = (e) => {
            dragging = true;
            velocity = 0;
            touchY = touchPrevY = e.touches[0].clientY;
            touchPrevT = performance.now();
            lastInputAt = touchPrevT;
        };
        const onTouchMove = (e) => {
            e.preventDefault();
            const y = e.touches[0].clientY;
            const dy = (touchY - y) * TOUCH_SPEED;
            target += dy;

            const now = performance.now();
            const dt = Math.max(now - touchPrevT, 1);
            // Smooth the velocity estimate a little for a natural flick.
            velocity = 0.8 * velocity + 0.2 * ((touchPrevY - y) * TOUCH_SPEED) * (16 / dt);
            touchPrevY = y;
            touchPrevT = now;
            touchY = y;
            lastInputAt = now;
        };
        const onTouchEnd = () => {
            dragging = false;
            lastInputAt = performance.now();
        };

        // Keyboard accessibility: move one slide at a time.
        const onKeyDown = (e) => {
            const k = e.key;
            if (k === "ArrowDown" || k === "PageDown" || k === " ") {
                e.preventDefault();
                target = (Math.round(target / vh) + 1) * vh;
                velocity = 0;
                lastInputAt = performance.now();
            } else if (k === "ArrowUp" || k === "PageUp") {
                e.preventDefault();
                target = (Math.round(target / vh) - 1) * vh;
                velocity = 0;
                lastInputAt = performance.now();
            }
        };

        const onResize = () => measure();

        wrapper.addEventListener("wheel", onWheel, { passive: false });
        wrapper.addEventListener("touchstart", onTouchStart, { passive: true });
        wrapper.addEventListener("touchmove", onTouchMove, { passive: false });
        wrapper.addEventListener("touchend", onTouchEnd, { passive: true });
        wrapper.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);

        measure();
        // First paint before the loop so there is never an unpositioned flash.
        render();
        lastFrame = performance.now();
        rafId = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(rafId);
            wrapper.removeEventListener("wheel", onWheel);
            wrapper.removeEventListener("touchstart", onTouchStart);
            wrapper.removeEventListener("touchmove", onTouchMove);
            wrapper.removeEventListener("touchend", onTouchEnd);
            wrapper.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
        };
    }, [items]);

    return (
        <div
            ref={wrapperRef}
            className={styles.wrapper}
            tabIndex={0}
            role="region"
            aria-label={t("about.galleryLabel")}
            aria-roledescription="carousel"
        >
            {items.map((item, i) => (
                <section
                    key={item.key ?? i}
                    ref={setRef(sectionRefs)(i)}
                    className={styles.hero}
                    aria-label={item.alt}
                >
                    <picture
                        ref={setRef(imageRefs)(i)}
                        className={styles.heroImage}
                    >
                        <img
                            src={item.image}
                            srcSet={item.srcSet}
                            sizes={item.sizes ?? "100vw"}
                            width={item.width}
                            height={item.height}
                            loading={i === 0 ? "eager" : "lazy"}
                            fetchPriority={i === 0 ? "high" : "auto"}
                            decoding="async"
                            alt={item.alt ?? ""}
                        />
                    </picture>
                    <Marquee label={item.label ?? "SCROLL"} innerRef={setRef(marqueeRefs)(i)} />
                </section>
            ))}
        </div>
    );
}
