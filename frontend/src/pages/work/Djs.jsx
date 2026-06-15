import { useTranslation } from "react-i18next";
import ParallaxScroll from "../../components/ParallaxScroll";
import MusicBars from "../../components/MusicBars";

const CLOUD_NAME = "dfolcjrpf";

function cloudinary(publicId, width = 1440) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

export default function DjsPage() {
    const { t } = useTranslation();

    const items = [
        {
            key: "agoria",
            publicId: "agoria",
            catKey: "agoria",
        },
        {
            key: "amor",
            publicId: "amor",
            catKey: "amor",
        },
        {
            key: "armado",
            publicId: "armado",
            catKey: "armadoxmao",
        },
        {
            key: "bilal",
            publicId: "bilalchef",
            catKey: "bilal the chef",
        },
        {
            key: "damike",
            publicId: "damike",
            catKey: "damike",
        },
        {
            key: "eran",
            publicId: "eran",
            catKey: "eran hersh",
        },
        {
            key: "kashovski",
            publicId: "kashovski",
            catKey: "kashovski",
        },
        {
            key: "kaudron",
            publicId: "kaudron",
            catKey: "kaudron",
        },
        {
            key: "livak",
            publicId: "livak",
            catKey: "liva k",
        },
        {
            key: "mariobadbox",
            publicId: "mariobadbox",
            catKey: "mario badbox",
        },
        {
            key: "passo",
            publicId: "passo",
            catKey: "passo doble",
        },
        {
            key: "safar",
            publicId: "safar",
            catKey: "safar",
        },
        {
            key: "sarah",
            publicId: "sarah",
            catKey: "sarah costa",
        },
        {
            key: "wildchild",
            publicId: "wildchild",
            catKey: "the wild child",
        },
        {
            key: "trodjman",
            publicId: "trodjman",
            catKey: "trodjman",
        },
        {
            key: "vanco",
            publicId: "vanco",
            catKey: "vanco",
        },
    ].map(({ key, publicId, catKey }) => ({
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
    }));

    return (
        <>
            <MusicBars src="/audios/djgordo.mp3" />
            <ParallaxScroll items={items} />
        </>
    );
}