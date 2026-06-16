import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HomePage.module.css";
import Seo from "../components/Seo";
import ParticleDepthGallery from '../components/ParticleDepthGallery'
gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const { t } = useTranslation();
  const bgRef = useRef(null);
  const lndRef = useRef(null);
  const items = [
    {
      image: '/images/hair01.png',
      word: 'Silent Signature',
      pms: 'Argan & Oud',
      accentColor: '#4d613a',
      textColor: '#000000',
      background: '#98c996',
      blob1: '#b7e6c7',
      blob2: '#befac6',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/hair02.png',
      word: 'Golden Radiance',
      pms: 'Pure Argan Oil',
      accentColor: '#4f78fe',
      textColor: '#2e2e2e',
      background: '#fffaf0',
      blob1: '#ca0000',
      blob2: '#dbc8c8',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/hair03.png',
      word: 'Midnight Oud',
      pms: 'Sensual Fragrance',
      accentColor: '#feca4f',
      textColor: '#2e2e2e',
      background: '#ff0000',
      blob1: '#d32828',
      blob2: '#f1c6c6',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/hair04.png',
      word: 'Magnetic Aura',
      pms: 'Lasting Impression',
      accentColor: '#4f78fe',
      textColor: '#2e2e2e',
      background: '#efb173',
      blob1: '#fbcd9d',
      blob2: '#c37a46',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/djs/sarah-1440.webp',
      word: 'Velvet Softness',
      pms: 'Deep Nourishment',
      accentColor: '#feca4f',
      textColor: '#2e2e2e',
      background: '#fffaf0',
      blob1: '#ffdf94',
      blob2: '#fce7c4',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/djs/wildchild-1440.webp',
      word: 'Eastern Elegance',
      pms: 'Rare Essence',
      accentColor: '#4f78fe',
      textColor: '#2e2e2e',
      background: '#fffaf0',
      blob1: '#ca0000',
      blob2: '#e00000',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/djs/sarah-1440.webp',
      word: 'Own Your Mystery',
      pms: 'Luxury Ritual',
      accentColor: '#feca4f',
      textColor: '#2e2e2e',
      background: '#fffaf0',
      blob1: '#ffdf94',
      blob2: '#fce7c4',
      position: { x: -0.9, y: 0 },
    },
    {
      image: '/images/djs/wildchild-1440.webp',
      word: 'Unforgettable Presence',
      pms: 'Signature Scent',
      accentColor: '#4f78fe',
      textColor: '#2e2e2e',
      background: '#fffaf0',
      blob1: '#ca0000',
      blob2: '#dbc8c8',
      position: { x: -0.9, y: 0 },
    },
  ];

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
      <div style={{ width: '100%', height: '100vh' }}>
        <ParticleDepthGallery items={items} pointerForce={0.1} tilt={0} />
      </div>
    </div>
  );
}
