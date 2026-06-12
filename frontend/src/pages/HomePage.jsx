import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HomePage.module.css";
import ParallaxScroll from "../components/ParallaxScroll";
gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const bgRef = useRef(null);
  const lndRef = useRef(null);

  useLayoutEffect(() => {
    if (!lndRef.current || !bgRef.current) return;

    // Reset everything every time HomePage mounts
    gsap.set(lndRef.current, {
      opacity: 1,
      clearProps: "transform",
    });

    gsap.set(bgRef.current, {
      yPercent: 0,
      clearProps: "transform",
    });

    const ctx = gsap.context(() => {
      const bgTween = gsap.to(bgRef.current, {
        yPercent: -20,
        ease: "none",
        scrollTrigger: {
          trigger: lndRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      const fadeTween = gsap.to(lndRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: lndRef.current,
          start: "15% top",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      return () => {
        bgTween.scrollTrigger?.kill();
        fadeTween.scrollTrigger?.kill();

        bgTween.kill();
        fadeTween.kill();
      };
    });

    return () => {
      ctx.revert();

      // Force reset so next visit starts fresh
      gsap.set(lndRef.current, {
        opacity: 1,
        clearProps: "all",
      });

      gsap.set(bgRef.current, {
        clearProps: "all",
      });
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.landing} ref={lndRef}>
        <div
          ref={bgRef}
          className={styles.bg}
        />
      </div>

      <div className={styles.next}>
        Content
      </div>

      <div className={styles.next}>
        Content
      </div>
    </div>

  );
}