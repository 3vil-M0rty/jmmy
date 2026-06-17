import { useTranslation } from "react-i18next";
import ParallaxScroll from "../components/ParallaxScroll";
import Seo from "../components/Seo";
import ParticleDepthGallery from "../components/ParticleDepthGallery";

/** Build a responsive WebP source set from the optimized variants on disk. */
const CLOUD_NAME = "dfolcjrpf";

function cloudinary(publicId, width = 1440) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

export default function WorkPage() {
    const { t } = useTranslation();

    // Add as many slides as you like — the scroller stays smooth and seamless.
   
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


    return (
        <div style={{ width: "100%", height: "100vh" }}>
            <ParticleDepthGallery
                items={items}
                pointerForce={0}
                tilt={0.02}
            />
        </div>
    );
}
