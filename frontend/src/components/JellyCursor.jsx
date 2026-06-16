import { useEffect, useRef } from "react";

export default function JellyCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    if ("ontouchstart" in window) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = cursorRef.current;
    if (!el) return;

    const pos = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let hoverScale = 1;     // current, lerped
    let hoverTarget = 1;    // 1 = idle, 0.5 = over clickable
    let running = false;
    let rafId = 0;

    const SPEED = 0.35;
    const MAX_JELLY = 0.25;

    function frame() {
      // position lerp
      pos.x += (target.x - pos.x) * SPEED;
      pos.y += (target.y - pos.y) * SPEED;

      const vx = target.x - pos.x;
      const vy = target.y - pos.y;

      // hover scale lerp
      hoverScale += (hoverTarget - hoverScale) * 0.2;

      const dist = Math.sqrt(vx * vx + vy * vy);
      const jelly = Math.min(dist / 100, MAX_JELLY);
      const angle = (Math.atan2(vy, vx) * 180) / Math.PI;

      // blend jelly out as we approach hover state
      const jf = (hoverScale - 0.5) / 0.5; // 1 idle → 0 hovering
      const sx = hoverScale * (1 + jf * jelly);
      const sy = hoverScale * (1 - jf * jelly);

      // ONE transform write per frame
      el.style.transform =
        `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) ` +
        `rotate(${angle}deg) scale(${sx}, ${sy})`;

      // sleep when settled
      const settled =
        dist < 0.1 &&
        Math.abs(target.x - pos.x) < 0.1 &&
        Math.abs(target.y - pos.y) < 0.1 &&
        Math.abs(hoverTarget - hoverScale) < 0.001;

      if (settled) {
        running = false;
      } else {
        rafId = requestAnimationFrame(frame);
      }
    }

    function kick() {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(frame);
      }
    }

    const onMove = (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      kick();
    };

    // delegated hover — fires only on element-boundary crossings
    const onOver = (e) => {
      if (e.target.closest("a, button, [role=button]")) {
        hoverTarget = 0.5;
        kick();
      }
    };
    const onOut = (e) => {
      if (e.target.closest("a, button, [role=button]")) {
        hoverTarget = 1;
        kick();
      }
    };

    // opacity handled by CSS transition (compositor, off main thread)
    const hide = () => (el.style.opacity = "0");
    const show = () => (el.style.opacity = "1");

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("mouseleave", hide);
    document.addEventListener("mouseenter", show);

    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((f) => {
      f.addEventListener("mouseenter", hide);
      f.addEventListener("mouseleave", show);
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("mouseleave", hide);
      document.removeEventListener("mouseenter", show);
      iframes.forEach((f) => {
        f.removeEventListener("mouseenter", hide);
        f.removeEventListener("mouseleave", show);
      });
    };
  }, []);

  return <div id="jelly-cursor" ref={cursorRef} />;
}