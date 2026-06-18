import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./HomePage.module.css";
import Seo from "../components/Seo";
import ParticleDepthGallery from "../components/ParticleDepthGallery";
import GooeyButton from "../components/GooeyButton";
import OilyBlob from "../components/OilyBlob";
import BrandIcon from "../components/Brandicon";

gsap.registerPlugin(ScrollTrigger);
const CLOUD_NAME = "dfolcjrpf";

function cloudinary(publicId, width = 1440) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}
export default function HomePage() {
    const { t } = useTranslation();

    const bgRef = useRef(null);
    const bgMobileRef = useRef(null);

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
        if (!lndRef.current) return;
        const bgEls = [bgRef.current, bgMobileRef.current].filter(Boolean);

        gsap.set(lndRef.current, { opacity: 1 });
        if (bgEls.length) gsap.set(bgEls, { yPercent: 0 });

        const ctx = gsap.context(() => {
            if (bgEls.length) {
                gsap.to(bgEls, {
                    yPercent: -20,
                    ease: "none",
                    scrollTrigger: {
                        trigger: lndRef.current,
                        start: "top top",
                        end: "bottom top",
                        scrub: true,
                    },
                });
            }

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

            if (wavePanelRef.current) {
                gsap.to(wavePanelRef.current, {
                    y: -25,
                    duration: 5,
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut",
                });
            }

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

                <BrandIcon size={320} color="#000" />


                <OilyBlob
                    className={styles.blob}
                    color="#eeff00"        // orb tint
                    dropletColor="#eeff00" // dragged droplets (defaults to color if omitted)
                    opacity={1}          // 0 = clear, 1 = solid. lower = more text shows through
                    orbScale={0.7}           // 1.3 = bigger orb, 0.8 = smaller
                    dropletScale={0.3}       // 1.6 = fatter droplets, 0.6 = tiny beads
                    gooeyness={0.3}        // 0.8 = long stringy sticky neck, 0.3 = snaps off quickly
                />
            </div>

            {/* <div style={{ width: "100%", height: "100vh" }}>
                <ParticleDepthGallery
                    items={items}
                    pointerForce={0}
                    tilt={0.02}
                />
            </div> */}
            <section className={styles.next}>
                <h2 className={styles.sectionTitle}>
                    Shine & Fragrance
                </h2>

                <p className={styles.sectionBody}>
                    A luminous hair ritual that nourishes deeply and
                    leaves a captivating scent that lingers all day.
                </p>
            </section>
        </div>
    );
}
