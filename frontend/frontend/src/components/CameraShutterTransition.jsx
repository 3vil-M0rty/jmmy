import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import gsap from 'gsap';
import './CameraShutterTransition.css';

/* ------------------------------------------------------------------ */
/*  Geometry — computed once at module load                            */
/* ------------------------------------------------------------------ */

const VB = 1000;          // viewBox size
const CX = 500;
const CY = 500;
const HOLE_R = 170;       // visible aperture radius (viewBox units)
const CLIP_R = 173;       // blade clip (slightly larger, hidden under the ring)
const BLADE_COUNT = 6;
const OPEN_ROT = -58;     // blade rotation when fully open
const CLOSED_ROT = 8;     // slight over-rotation so blades overlap when closed

const DEG = Math.PI / 180;

const rotatePoint = ([x, y], angleDeg) => {
  const s = Math.sin(angleDeg * DEG);
  const c = Math.cos(angleDeg * DEG);
  const dx = x - CX;
  const dy = y - CY;
  return [CX + dx * c - dy * s, CY + dx * s + dy * c];
};

// One blade in its "closed" rest pose: a quad whose top edge passes
// through the center, pivoting on a point just outside the aperture.
const BLADE_BASE = [
  [730, 500],   // pivot (on a 230-radius ring around center)
  [230, 500],
  [230, 1140],
  [730, 1140],
];

const BLADES = Array.from({ length: BLADE_COUNT }, (_, i) => {
  const angle = i * (360 / BLADE_COUNT);
  return {
    points: BLADE_BASE
      .map((p) => rotatePoint(p, angle))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' '),
    origin: rotatePoint([730, 500], angle)
      .map((v) => v.toFixed(1))
      .join(' '),
  };
});

// Dark plane with a circular hole punched out (even-odd fill).
// Big enough to cover the viewport at the rig's minimum scale; anything
// outside the svg viewport is culled by the renderer, so this is cheap.
const SURROUND_PATH =
  `M-6000,-6000 H7000 V7000 H-6000 Z ` +
  `M${CX - 196},${CY} a196,196 0 1,0 392,0 a196,196 0 1,0 -392,0 Z`;

const TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = i * 10;
  const [x1, y1] = rotatePoint([CX + 189, CY], a);
  const [x2, y2] = rotatePoint([CX + 194, CY], a);
  return { x1, y1, x2, y2 };
});

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/*                                                                     */
/*  The <svg> stays viewport-sized and is NEVER transformed. All the   */
/*  motion happens on an inner <g> rig scaled in viewBox space. SVG    */
/*  culls anything outside the viewport each frame, so huge zoom       */
/*  levels never create oversized GPU layers (which previously caused  */
/*  dropped tiles / flickering at the start of the close).             */
/* ------------------------------------------------------------------ */

const CameraShutterTransition = forwardRef(function CameraShutterTransition(
  { playOnMount = true, speed = 1 },
  ref
) {
  const overlayRef = useRef(null);
  const rigRef = useRef(null);
  const bladeRefs = useRef([]);
  const tlRef = useRef(null);

  const setState = (state) => {
    if (overlayRef.current) overlayRef.current.dataset.state = state;
  };

  /**
   * The svg uses preserveAspectRatio="slice", so one viewBox unit maps
   * to max(vw, vh) / 1000 pixels.
   *  - base: rig scale at which the lens reads as a small centered shutter
   *  - zoom: rig scale at which the aperture edge clears the viewport corners
   */
  const getScales = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const k = Math.max(vw, vh) / VB;               // px per viewBox unit
    const lensPx = Math.min(0.58 * Math.min(vw, vh), 500);
    const base = lensPx / Math.max(vw, vh);        // lens drawn at lensPx wide
    const holePx = HOLE_R * k;                     // hole radius at rig scale 1
    const zoom = ((Math.hypot(vw, vh) / 2) / holePx) * 1.25;
    return { base, zoom };
  };

  /**
   * Blades swing open, then the whole shutter assembly accelerates
   * toward the camera (scale) and exits past the viewport edges.
   */
  const playOpen = useCallback((onComplete) => {
    tlRef.current?.kill();
    const rig = rigRef.current;
    const blades = bladeRefs.current;
    setState('active');

    const { base, zoom } = getScales();

    // Apply the starting pose immediately, outside the timeline, so the
    // first painted frame is guaranteed correct and can't race the .to()s.
    gsap.set(rig, { svgOrigin: `${CX} ${CY}`, scale: base, rotation: 0 });
    gsap.set(blades, { rotation: CLOSED_ROT });

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        setState('idle');
        onComplete?.();
      },
    });

    tl.to(
        blades,
        {
          rotation: OPEN_ROT,
          duration: 0.9,
          ease: 'power3.inOut',
          stagger: 0.02,
        },
        0.12
      )
      .to(rig, { rotation: -8, duration: 1.05, ease: 'power2.in' }, 0.4)
      .to(rig, { scale: zoom, duration: 1.05, ease: 'power3.in' }, 0.5);

    tl.timeScale(prefersReducedMotion() ? 8 : speed);
    tlRef.current = tl;
    return tl;
  }, [speed]);

  /**
   * The shutter dives back in from outside the screen, settles at the
   * center, and the blades iris shut. `onComplete` fires once fully
   * closed (this is where the route swap happens).
   */
  const playClose = useCallback((onComplete) => {
    tlRef.current?.kill();
    const rig = rigRef.current;
    const blades = bladeRefs.current;
    setState('active');

    const { base, zoom } = getScales();

    // Pre-set the off-screen starting pose (shutter out past the viewport,
    // blades open) before the timeline runs, so frame one is clean.
    gsap.set(rig, { svgOrigin: `${CX} ${CY}`, scale: zoom, rotation: -8 });
    gsap.set(blades, { rotation: OPEN_ROT });

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => onComplete?.(),
    });

    tl.to(rig, { scale: base, rotation: 0, duration: 1.0, ease: 'power3.out' }, 0)
      .to(
        blades,
        {
          rotation: CLOSED_ROT,
          duration: 0.8,
          ease: 'power3.inOut',
          stagger: 0.02,
        },
        0.38
      );

    tl.timeScale(prefersReducedMotion() ? 8 : speed);
    tlRef.current = tl;
    return tl;
  }, [speed]);

  useImperativeHandle(ref, () => ({ playOpen, playClose }), [
    playOpen,
    playClose,
  ]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Cache each blade's pivot once; later tweens only animate rotation.
      bladeRefs.current.forEach((blade, i) => {
        gsap.set(blade, { svgOrigin: BLADES[i].origin, rotation: CLOSED_ROT });
      });

      // Put the rig in its closed, centered pose before first paint.
      const { base } = getScales();
      gsap.set(rigRef.current, {
        svgOrigin: `${CX} ${CY}`,
        scale: base,
        rotation: 0,
      });

      if (playOnMount) {
        playOpen();
      } else {
        setState('idle');
      }
    }, overlayRef);

    return () => {
      tlRef.current?.kill();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={overlayRef} className="cst-overlay" data-state="active">
      <svg
        className="cst-shutter"
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="cst-blade-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="55%" stopColor="#000000" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          <linearGradient id="cst-barrel-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="45%" stopColor="#000000" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          <clipPath id="cst-hole-clip">
            <circle cx={CX} cy={CY} r={CLIP_R} />
          </clipPath>
        </defs>

        {/* Everything lives in the rig; GSAP scales/rotates this group */}
        <g ref={rigRef}>
          {/* Dark plane covering the page, hole punched for the lens */}
          <path d={SURROUND_PATH} fill="#000000" fillRule="evenodd" />

          {/* Iris blades, clipped to the aperture */}
          <g clipPath="url(#cst-hole-clip)">
            {BLADES.map((blade, i) => (
              <polygon
                key={i}
                ref={(el) => (bladeRefs.current[i] = el)}
                className="cst-blade"
                points={blade.points}
                fill="url(#cst-blade-grad)"
              />
            ))}
            {/* Inner shadow at the aperture edge */}
            <circle
              cx={CX}
              cy={CY}
              r={HOLE_R - 5}
              fill="none"
              stroke="rgba(0, 0, 0, 1)"
              strokeWidth="12"
            />
          </g>

          {/* Lens barrel ring covering the clip seam */}
          <circle
            cx={CX}
            cy={CY}
            r={183}
            fill="none"
            stroke="url(#cst-barrel-grad)"
            strokeWidth="27"
          />
          <circle
            cx={CX}
            cy={CY}
            r={170}
            fill="none"
            stroke="#000000"
            strokeWidth="2.5"
          />
          <circle
            cx={CX}
            cy={CY}
            r={196.5}
            fill="none"
            stroke="#000000"
            strokeWidth="3"
          />

          {/* Focus-ring ticks */}
          <g
            stroke="rgba(0, 0, 0, 1)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {TICKS.map((t, i) => (
              <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
});

export default CameraShutterTransition;