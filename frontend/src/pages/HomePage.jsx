import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HomePage.module.css";
import Seo from "../components/Seo";
import ParticleDepthGallery from "../components/ParticleDepthGallery";

gsap.registerPlugin(ScrollTrigger);
const CLOUD_NAME = "dfolcjrpf";

function cloudinary(publicId, width = 1440) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}
export default function HomePage() {
    const { t } = useTranslation();

    const bgRef = useRef(null);
    const lndRef = useRef(null);
    const wavePanelRef = useRef(null);

    const items = [
        {
            image: cloudinary("h2"),
            word: "Silent Signature",
            pms: "Argan & Oud",
            accentColor: "#4d613a",
            textColor: "#000000",
            background: "rgb(163, 175, 138)",
            blob1: "#d1ebcc",
            blob2: "#96af8a",
            position: { x: -0.9, y: 0 },
        },
        {
            image: cloudinary("h01"),
            word: "Golden Radiance",
            pms: "Pure Argan Oil",
            accentColor: "#4f78fe",
            textColor: "#2e2e2e",
            background: "#ff0000",
            blob1: "#d32828",
            blob2: "#f1c6c6",
            position: { x: -0.9, y: 0 },
        },
        {
            image: cloudinary("h1"),
            word: "Midnight Oud",
            pms: "Sensual Fragrance",
            accentColor: "#feca4f",
            textColor: "#2e2e2e",
            background: "#635d5d",
            blob1: "#cebcbc",
            blob2: "#f1e3e3",
            position: { x: -0.9, y: 0 },
        },
        {
            image: cloudinary("h02"),
            word: "Magnetic Aura",
            pms: "Lasting Impression",
            accentColor: "#4f78fe",
            textColor: "#2e2e2e",
            background: "#efb173",
            blob1: "#fbcd9d",
            blob2: "#c37a46",
            position: { x: -0.9, y: 0 },
        },
    ];

    useLayoutEffect(() => {
        if (!lndRef.current || !bgRef.current) return;

        gsap.set(lndRef.current, { opacity: 1 });
        gsap.set(bgRef.current, { yPercent: 0 });

        const ctx = gsap.context(() => {
            gsap.to(bgRef.current, {
                yPercent: -20,
                ease: "none",
                scrollTrigger: {
                    trigger: lndRef.current,
                    start: "top top",
                    end: "bottom top",
                    scrub: true,
                },
            });

            gsap.to(lndRef.current, {
                opacity: 0,
                ease: "none",
                scrollTrigger: {
                    trigger: lndRef.current,
                    start: "15% top",
                    end: "bottom top",
                    scrub: true,
                },
            });

            gsap.to(wavePanelRef.current, {
                y: -25,
                duration: 5,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            });

            requestAnimationFrame(() => ScrollTrigger.refresh());
        });

        return () => ctx.revert();
    }, []);

    return (
        <div className={styles.container}>
            <Seo
                titleKey="seo.home.title"
                descriptionKey="seo.home.description"
            />

            <div className={styles.landing} ref={lndRef}>
                <video
                    ref={bgRef}
                    className={styles.bg}
                    autoPlay
                    muted
                    loop
                    playsInline
                >
                    <source src="/videos/back.mp4" type="video/mp4" />
                </video>

                {/* <div className={styles.overlay} />

                <div
                    ref={wavePanelRef}
                    className={styles.wavePanel}
                >
                    <svg
                        className={styles.waveSvg}
                        viewBox="0 0 1000 1000"
                        preserveAspectRatio="none"
                    >
                        <path
                            d="
                                M400 0
                                C650 150 450 350 760 500
                                C980 650 820 850 1000 1000
                                L1000 0
                                Z
                            "
                        />
                    </svg>

                    <div className={styles.panelContent}>
                        <span>ARGAN & OUD</span>

                        <h2>
                            Own Your
                            <br />
                            Mystery
                        </h2>
                    </div>
                </div> */}

                {/* <div className={styles.hero}>
                    <p className={styles.eyebrow}>
                        THE ART OF AN UNFORGETTABLE PRESENCE
                    </p>

                    <h1 className={styles.title}>
                        Soft Yet
                        <br />
                        Powerful
                    </h1>

                    <p className={styles.subtitle}>
                        Mysterious. Radiant.
                        <br />
                        Unforgettable.
                    </p>
                </div> */}
            </div>

            {/* <section className={styles.next}>
                <h2 className={styles.sectionTitle}>
                    Signature Scent
                </h2>

                <p className={styles.sectionBody}>
                    Inspired by the heritage of Eastern perfumery,
                    crafted with precious Argan Oil and rare Oud.
                </p>
            </section>

            <section className={styles.next}>
                <h2 className={styles.sectionTitle}>
                    Shine & Fragrance
                </h2>

                <p className={styles.sectionBody}>
                    A luminous hair ritual that nourishes deeply and
                    leaves a captivating scent that lingers all day.
                </p>
            </section>

            <div style={{ width: "100%", height: "100vh" }}>
                <ParticleDepthGallery
                    items={items}
                    pointerForce={0}
                    tilt={0.02}
                />
            </div> */}
            <div style={{ width: "100%", height: "100vh" }}>
                <ParticleDepthGallery
                    items={items}
                    pointerForce={0}
                    tilt={0.02}
                />
            </div>
        </div>
    );
}