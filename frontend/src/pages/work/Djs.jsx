import { useTranslation } from "react-i18next";
import MusicBars from "../../components/MusicBars";


export default function WorkPage() {
    const { t } = useTranslation();

    // Add as many slides as you like — the scroller stays smooth and seamless.

    return (
        <>
            <MusicBars src="/audios/djgordo.mp3" />

        </>
    );
}
