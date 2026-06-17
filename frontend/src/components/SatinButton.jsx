import { useId, useState } from "react";

/**
 * SatinButton
 * A minimal, feminine luxury CTA. On hover the fill crossfades, the letter-
 * spacing breathes open, and a soft light sheen glides once across the face —
 * like light catching satin or a gold bullet. Pure CSS, no dependencies.
 *
 * Pair with a serif display face for the full effect (Cormorant Garamond,
 * Didot, Bodoni). Falls back gracefully.
 */
export default function SatinButton({
  text = "Discover",
  href = "#",
  baseColor = "#211C1A",        // resting fill (deep espresso)
  actionColor = "#C7A86B",      // hover fill (champagne gold)
  textColor = "#C7A86B",        // resting text
  textColorHover = "#211C1A",   // text once filled
  borderColor,                  // hairline (defaults to actionColor)
  sheenColor = "rgba(255,251,242,0.55)",
  radius = 4,                   // try 999 for a soft pill
  fontFamily = "'Cormorant Garamond','Didot','Bodoni MT',Georgia,serif",
  onClick,
  className = "",
  ...rest
}) {
  const uid = useId().replace(/[:]/g, "");
  const root = `satin-${uid}`;
  const line = borderColor ?? actionColor;
  const [sweep, setSweep] = useState(0); // re-keys the sheen to replay it

  const css = `
    .${root} { display: inline-block; }
    .${root} *, .${root} *::before, .${root} *::after { box-sizing: border-box; }

    .${root} .gb-button {
      -webkit-font-smoothing: antialiased;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background-color: ${baseColor};
      color: ${textColor};
      border: 1px solid ${line};
      border-radius: ${radius}px;
      font-family: ${fontFamily};
      font-size: 15px;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.28em;
      text-indent: 0.28em;            /* balance the trailing tracking */
      text-transform: uppercase;
      text-decoration: none;
      user-select: none;
      padding: 19px 46px;
      transition:
        background-color 0.55s cubic-bezier(0.22, 0.61, 0.36, 1),
        color 0.55s cubic-bezier(0.22, 0.61, 0.36, 1),
        letter-spacing 0.55s cubic-bezier(0.22, 0.61, 0.36, 1),
        text-indent 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    .${root} .gb-button:hover,
    .${root} .gb-button:focus-visible {
      background-color: ${actionColor};
      color: ${textColorHover};
      letter-spacing: 0.34em;
      text-indent: 0.34em;
    }
    .${root} .gb-button:focus-visible {
      outline: none;
      box-shadow: 0 0 0 1px ${baseColor}, 0 0 0 3px ${line};
    }
    .${root} .gb-button:active { transform: translateY(0.5px); }

    .${root} .gb-label { position: relative; z-index: 2; }

    /* the sheen — a soft, skewed band of light that crosses once */
    .${root} .gb-sheen {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      border-radius: inherit;
    }
    .${root} .gb-sheen::before {
      content: "";
      position: absolute;
      top: -25%;
      bottom: -25%;
      left: -30%;
      width: 45%;
      background: linear-gradient(90deg, transparent, ${sheenColor}, transparent);
      filter: blur(1px);
      opacity: 0;
      transform: translateX(-60%) skewX(-18deg);
    }
    .${root} .gb-sheen.run::before {
      animation: gb-sweep-${uid} 0.95s cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    @keyframes gb-sweep-${uid} {
      0%   { transform: translateX(-60%) skewX(-18deg); opacity: 0; }
      16%  { opacity: 1; }
      100% { transform: translateX(420%) skewX(-18deg); opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .${root} .gb-button { transition: background-color 0.2s ease, color 0.2s ease; }
      .${root} .gb-button:hover,
      .${root} .gb-button:focus-visible { letter-spacing: 0.28em; text-indent: 0.28em; }
      .${root} .gb-sheen.run::before { animation: none; }
    }
  `;

  return (
    <span className={`${root} ${className}`.trim()}>
      <style>{css}</style>
      <a
        href={href}
        className="gb-button"
        onMouseEnter={() => setSweep((s) => s + 1)}
        onFocus={() => setSweep((s) => s + 1)}
        onClick={onClick}
        {...rest}
      >
        <span
          key={sweep}
          className={`gb-sheen${sweep > 0 ? " run" : ""}`}
          aria-hidden="true"
        />
        <span className="gb-label">{text}</span>
      </a>
    </span>
  );
}
