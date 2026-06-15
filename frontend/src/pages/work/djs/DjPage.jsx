import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import GalleryImages from "../../../components/GalleryImages";
import MusicBars from "../../../components/MusicBars";
import { DJs } from "../../../data/djs";

const CLOUD_NAME = "dfolcjrpf";

function cloudinary(publicId, width = 1440) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

export default function DjPage() {
  const { slug } = useParams();
  const { t } = useTranslation();

  const dj = DJs[slug];

  if (!dj) {
    return <h1>DJ not found</h1>;
  }

  const items = dj.scenes.map((scene) => ({
    ...scene,
    image: cloudinary(scene.publicId),
    alt: t("about.alt.djs"),
  }));

  return (
    <>
      <MusicBars src={dj.audio} />
      <GalleryImages items={items} />
    </>
  );
}