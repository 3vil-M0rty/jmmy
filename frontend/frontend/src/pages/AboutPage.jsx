import { useTranslation } from "react-i18next";
import ParallaxScroll from "../components/ParallaxScroll";
import Seo from "../components/Seo";

/** Build a responsive WebP source set from the optimized variants on disk. */
function responsive(base) {
    return {
        image: `${base}-1440.webp`,
        srcSet: `${base}-960.webp 960w, ${base}-1440.webp 1440w, ${base}-2560.webp 2560w`,
        sizes: "100vw",
    };
}

export default function AboutPage() {
    const { t } = useTranslation();

    // Add as many slides as you like — the scroller stays smooth and seamless.
    const items = [
        { key: "djs", base: "/images/djs/wildchild", catKey: "djs" },
        { key: "streets", base: "/images/streets/street1", catKey: "streets" },
        { key: "bands", base: "/images/bands/sabo", catKey: "bands" },
        { key: "fashion", base: "/images/fashion/fashion", catKey: "fashion" },
        { key: "food", base: "/images/food/food", catKey: "food" },
    ].map(({ key, base, catKey }) => ({
        key,
        ...responsive(base),
        label: t(`about.categories.${catKey}`),
        alt: t(`about.alt.${catKey}`),
    }));

    return (
        <>
            <Seo titleKey="seo.about.title" descriptionKey="seo.about.description" />
            <ParallaxScroll items={items} />
        </>
    );
}
