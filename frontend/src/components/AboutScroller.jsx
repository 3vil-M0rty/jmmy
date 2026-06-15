import { useRef, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";
import styles from "./AboutScroller.module.css";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

/* ------------------------------------------------------------------ */
/* Cloudinary                                                          */
/* ------------------------------------------------------------------ */
const CLOUD_NAME = "dfolcjrpf"; // <-- replace (or read from env)

function cloudinary(publicId, width = 1440) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

/* One entry per scene. Keep this the SAME LENGTH as the number of
   <path> elements in the markup below + one extra <section>.
   `catKey` is an i18n key for the caption text. */
const RAW_SCENES = [
  { key: "scene-1", publicId: "about/djs-1", catKey: "about.cat.house" },
  { key: "scene-2", publicId: "about/djs-2", catKey: "about.cat.techno" },
  { key: "scene-3", publicId: "about/djs-3", catKey: "about.cat.disco" },
  { key: "scene-4", publicId: "about/djs-4", catKey: "about.cat.ambient" },
  { key: "scene-5", publicId: "about/djs-5", catKey: "about.cat.live" },
];

/* Camera keyframes — one per motion-path leg (rotate + scale at the
   END of that leg). Index 0 is also the "from" reference for the very
   first leg. Tweak freely for landscape vs the responsive feel. */
const CAMERA = [
  { rotate: -5, scale: 2.5 },
  { rotate: 8, scale: 3.3 },
  { rotate: -4, scale: 2.75 },
  { rotate: 5, scale: 2 },
  { rotate: -5, scale: 3 },
];

export default function AboutScroller({items}) {
  const { t } = useTranslation();

  const root = useRef(null);
  const scroller = useRef(null);
  const scaleRef = useRef(null);
  const panRef = useRef(null);
  const focalRef = useRef(null);
  const pathsRef = useRef(null);

  const [active, setActive] = useState(0);

  // Exactly the shape you asked for.
  const scenes = useMemo(
    () =>
      items.map(({ key, publicId, catKey }) => ({
        key,
        image: cloudinary(publicId, 1440),
        srcSet: `
          ${cloudinary(publicId, 960)} 960w,
          ${cloudinary(publicId, 1440)} 1440w,
          ${cloudinary(publicId, 2560)} 2560w
        `,
        sizes: "100vw",
        label: catKey,
        alt: t("about.alt.djs"),
      })),
    [t]
  );

  useGSAP(
    () => {
      const pathEls = Array.from(pathsRef.current.querySelectorAll("path"));

      // Smoothed follow of the focal point (mirrors the prototype's quickTo).
      const xTo = gsap.quickTo(panRef.current, "x", { duration: 1.3, ease: "expo" });
      const yTo = gsap.quickTo(panRef.current, "y", { duration: 1.3, ease: "expo" });

      const tl = gsap.timeline({
        scrollTrigger: {
          scroller: scroller.current,
          trigger: root.current.querySelector(`.${styles.section}`),
          endTrigger: root.current.querySelector(`.${styles.section}:last-child`),
          start: "0 0",
          end: "100% 100%",
          scrub: 1,
        },
        onUpdate() {
          // Pan the scene so the focal point stays centred.
          xTo(-gsap.getProperty(focalRef.current, "x"));
          yTo(-gsap.getProperty(focalRef.current, "y"));

          // Drive the active scene (image + caption) from scroll progress.
          const idx = Math.min(
            scenes.length - 1,
            Math.floor(this.progress() * scenes.length)
          );
          setActive((prev) => (prev === idx ? prev : idx));
        },
        defaults: { duration: 1, ease: "none" },
      });

      pathEls.forEach((path, i) => {
        const cam = CAMERA[i] ?? CAMERA[CAMERA.length - 1];

        tl.to(focalRef.current, { motionPath: path, immediateRender: i === 0 }, i);

        if (i === 0) {
          tl.fromTo(
            scaleRef.current,
            { x: 500, y: 500, scale: 3.2, rotate: 20 },
            { rotate: cam.rotate, scale: cam.scale, ease: "sine.inOut" },
            0
          );
        } else {
          tl.to(
            scaleRef.current,
            { rotate: cam.rotate, scale: cam.scale, ease: "sine.inOut" },
            i
          );
        }
      });

      // Seed the pan to the first focal point so there's no jump on load.
      gsap.set(panRef.current, {
        x: -gsap.getProperty(focalRef.current, "x"),
        y: -gsap.getProperty(focalRef.current, "y"),
      });

      ScrollTrigger.refresh();
    },
    { scope: root, dependencies: [scenes] }
  );

  return (
    <div ref={root}>
      <div className={styles.fixedBg}>
        <div className={styles.frame}>
          <svg
            className={styles.svg}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="xMidYMid slice"
          >
            <g ref={scaleRef} className={styles.povScale}>
              <g ref={panRef} className={styles.povPan}>
                {scenes.map((s, i) => (
                  <foreignObject
                    key={s.key}
                    x={0}
                    y={0}
                    width={1000}
                    height={1000}
                    className={`${styles.scene} ${
                      i === active ? styles.sceneActive : ""
                    }`}
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      className={styles.sceneInner}
                    >
                      <img
                        className={styles.sceneImg}
                        src={s.image}
                        srcSet={s.srcSet}
                        sizes={s.sizes}
                        alt={s.alt}
                        loading={i === 0 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    </div>
                  </foreignObject>
                ))}

                {/* Invisible camera rails. Keep one <path> per scene. */}
                <g ref={pathsRef} className={styles.motionPaths} fill="none">
                  <path d="M196 434c66-49 230 44 322 18" />
                  <path d="M518 452c22-1 228 65 303 56" />
                  <path d="M821 508s-81 263-18 399" />
                  <path d="M803 907s-238-64-317-47" />
                  <path d="M486 860s-160 76-298 17" />
                </g>

                <circle ref={focalRef} className={styles.focalPoint} r={0} />
              </g>
            </g>
          </svg>
        </div>

        {/* Caption swaps with the active scene. key= remounts → fade-in. */}
        <div className={styles.caption}>
          <span key={active} className={styles.captionText}>
            {t(scenes[active].label)}
          </span>
        </div>
      </div>

      {/* Scroll track. One more section than there are scenes. */}
      <main ref={scroller} className={styles.scroller}>
        {Array.from({ length: scenes.length + 1 }).map((_, i) => (
          <section key={i} className={styles.section} />
        ))}
      </main>
    </div>
  );
}
