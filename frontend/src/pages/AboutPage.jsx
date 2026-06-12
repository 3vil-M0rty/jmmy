import { useTranslation } from 'react-i18next';
import ParallaxScroll from '../components/ParallaxScroll';

export default function AboutPage() {
  const { t } = useTranslation();
  const data = [
    { image: "/images/w01.jpg", alt: "Hero Image 1", label: "ATLAS" },
    { image: "/images/w02.jpg", alt: "Hero Image 2", label: "SAHARA" },
    { image: "/images/w03.jpg", alt: "Hero Image 3", label: "MEDINA" },
];
  return (
    <ParallaxScroll
      items={data}
    />
  );
}
