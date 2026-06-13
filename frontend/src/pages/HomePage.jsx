import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HomePage.module.css";
import Seo from "../components/Seo";
gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const { t } = useTranslation();
  const bgRef = useRef(null);
  const lndRef = useRef(null);

  useLayoutEffect(() => {
    if (!lndRef.current || !bgRef.current) return;

    gsap.set(lndRef.current, { opacity: 1, clearProps: "transform" });
    gsap.set(bgRef.current, { yPercent: 0, clearProps: "transform" });

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

      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        bgTween.scrollTrigger?.kill();
        fadeTween.scrollTrigger?.kill();
        bgTween.kill();
        fadeTween.kill();
      };
    });

    return () => {
      ctx.revert();
      gsap.set(lndRef.current, { opacity: 1, clearProps: "all" });
      gsap.set(bgRef.current, { clearProps: "all" });
    };
  }, []);

  return (
    <div className={styles.container}>
      <Seo titleKey="seo.home.title" descriptionKey="seo.home.description" />

      <div className={styles.landing} ref={lndRef}>
        <div ref={bgRef} className={styles.bg} />
        <div className={styles.hero}>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1 className={styles.title}>{t("home.title")}</h1>
          <p className={styles.subtitle}>{t("home.subtitle")}</p>
        </div>
      </div>

      <section className={styles.next}>
        <h2 className={styles.sectionTitle}>{t("home.section1Title")}</h2>
        <p className={styles.sectionBody}>{t("home.section1Body")}</p>
      </section>

      <section className={styles.next}>
        <h2 className={styles.sectionTitle}>{t("home.section2Title")}</h2>
        <p className={styles.sectionBody}>{t("home.section2Body")}</p>
      </section>
    </div>
  );
}
