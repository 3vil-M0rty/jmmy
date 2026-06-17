import { useRef, useEffect, useId } from "react";
import { gsap } from "gsap";

/**
 * HSL-lightness darken, mirroring SCSS `darken($color, $amount)`.
 * amount is 0–1 (e.g. 0.15 === darken 15%).
 */
function darken(hex, amount) {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  let r = parseInt(c.slice(0, 2), 16) / 255;
  let g = parseInt(c.slice(2, 4), 16) / 255;
  let b = parseInt(c.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }

  l = Math.max(0, l - amount);

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let nr;
  let ng;
  let nb;
  if (s === 0) {
    nr = ng = nb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    nr = hue2rgb(p, q, h + 1 / 3);
    ng = hue2rgb(p, q, h);
    nb = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

/**
 * Where each particle drifts to, in px, relative to its start point.
 * Top-left particles float up-and-left, bottom-right float down-and-right.
 * Gentle, varied angles — no two identical, none symmetrical-but-loud.
 */
const TOP_LEFT_DRIFT = [
  { x: -34, y: -20 },
  { x: -46, y: -8 },
  { x: -20, y: -36 },
];
const BOTTOM_RIGHT_DRIFT = [
  { x: 34, y: 20 },
  { x: 46, y: 8 },
  { x: 20, y: 36 },
];

export default function GooeyButton({
  text = "Discover",
  href = "#",
  baseColor = "#1c1a17",       // resting fill
  actionColor = "#c9a96a",     // hover fill (soft champagne by default)
  textColor = "#fff",
  textColorHover,              // text color on hover (defaults to textColor)
  particleColor,               // drifting circles (defaults to actionColor)
  borderColor = "transparent", // thin straight border
  borderWidth = 1,             // px
  radius = 0,                  // corner radius in px (0 = perfectly straight)
  onClick,
  className = "",
  ...rest
}) {
  const topLeftRefs = useRef([]);
  const bottomRightRefs = useRef([]);
  const timelineRef = useRef(null);

  const uid = useId().replace(/[:]/g, "");
  const root = `gooey-btn-${uid}`;

  const hoverText = textColorHover ?? textColor;
  const dots = particleColor ?? actionColor;

  useEffect(() => {
    const topLeft = topLeftRefs.current.filter(Boolean);
    const bottomRight = bottomRightRefs.current.filter(Boolean);
    if (topLeft.length < 3 || bottomRight.length < 3) return undefined;

    const all = [...topLeft, ...bottomRight];

    const tl = gsap.timeline({ paused: true });

    // reset to a calm starting state
    tl.set(all, { x: 0, y: 0, scale: 0.5, opacity: 0 });

    // soft emergence
    tl.to(topLeft, {
      opacity: 1, scale: 1, duration: 0.4, ease: "power2.out", stagger: 0.06,
    }, 0);
    tl.to(bottomRight, {
      opacity: 1, scale: 1, duration: 0.4, ease: "power2.out", stagger: 0.06,
    }, 0.04);

    // graceful drift outward + fade — smooth power ease, no bounce
    topLeft.forEach((el, i) => {
      tl.to(el, {
        x: TOP_LEFT_DRIFT[i].x,
        y: TOP_LEFT_DRIFT[i].y,
        scale: 0.35,
        opacity: 0,
        duration: 1.05,
        ease: "power2.out",
      }, 0.12 + i * 0.05);
    });
    bottomRight.forEach((el, i) => {
      tl.to(el, {
        x: BOTTOM_RIGHT_DRIFT[i].x,
        y: BOTTOM_RIGHT_DRIFT[i].y,
        scale: 0.35,
        opacity: 0,
        duration: 1.05,
        ease: "power2.out",
      }, 0.16 + i * 0.05);
    });

    tl.timeScale(1.1);
    timelineRef.current = tl;

    return () => { tl.kill(); };
  }, []);

  const handleEnter = () => {
    if (timelineRef.current) timelineRef.current.restart();
  };

  const css = `
    .${root} { position: relative; display: inline-block; }
    .${root} *, .${root} *::before, .${root} *::after { box-sizing: border-box; }

    .${root} .gb-button {
      -webkit-font-smoothing: antialiased;
      position: relative;
      z-index: 2;
      display: inline-block;
      background-color: ${baseColor};
      color: ${textColor};
      border: ${borderWidth}px solid ${borderColor};
      border-radius: ${radius}px;
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      font-weight: 300;
      letter-spacing: 3px;
      text-decoration: none;
      text-transform: uppercase;
      user-select: none;
      padding: 20px 46px;
      transition: background-color 0.45s ease, color 0.45s ease, border-color 0.45s ease;
    }
    .${root} .gb-button:hover {
      background-color: ${actionColor};
      color: ${hoverText};
    }

    .${root} .gb-particles {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    .${root} .gb-circle {
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: ${dots};
      opacity: 0;
      will-change: transform, opacity;
    }
    .${root} .gb-circle.top-left { top: 22%; left: 24%; }
    .${root} .gb-circle.bottom-right { bottom: 22%; right: 24%; }
  `;

  return (
    <span className={`${root} ${className}`.trim()}>
      <style>{css}</style>

      <a
        href={href}
        className="gb-button"
        onMouseEnter={handleEnter}
        onClick={onClick}
        {...rest}
      >
        {text}
      </a>

      <span className="gb-particles" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={`tl-${i}`}
            ref={(el) => { topLeftRefs.current[i] = el; }}
            className="gb-circle top-left"
          />
        ))}
        {[0, 1, 2].map((i) => (
          <span
            key={`br-${i}`}
            ref={(el) => { bottomRightRefs.current[i] = el; }}
            className="gb-circle bottom-right"
          />
        ))}
      </span>
    </span>
  );
}
