import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./MusicBars.module.css";

/**
 * MusicBars — minimal 5-bar music toggle.
 * Click the bars to play; click again to stop. Bars bounce while playing.
 *
 * Props:
 *   src       (string, required)  e.g. "/audio/track.mp3"
 *   loop      (boolean)           loop the track (default true)
 *   autoPlay  (boolean)           attempt to play on load (default true)
 *
 * Note on autoplay: browsers block audio from starting until the user has
 * interacted with the page. We attempt to play on mount; if the browser
 * blocks it, we start on the first click/tap/keypress anywhere on the page.
 */
export default function MusicBars({ src, loop = true, autoPlay = true }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);

    const play = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return false;
        try {
            await audio.play();
            return true;
        } catch {
            return false; // blocked or interrupted
        }
    }, []);

    const toggle = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) await play();
        else audio.pause();
    }, [play]);

    // Keep React state in sync with the media element.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onPlay = () => setPlaying(true);
        const onStop = () => setPlaying(false);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onStop);
        audio.addEventListener("ended", onStop);
        return () => {
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onStop);
            audio.removeEventListener("ended", onStop);
        };
    }, []);

    // Autoplay on load, with a first-gesture fallback for when the browser blocks it.
    useEffect(() => {
        if (!autoPlay) return;
        let cleanup = () => {};

        (async () => {
            const ok = await play();
            if (ok) return; // autoplay allowed — nothing else to do

            // Blocked: start on the first user interaction anywhere.
            const start = async () => {
                const started = await play();
                if (started) remove();
            };
            const remove = () => {
                window.removeEventListener("pointerdown", start);
                window.removeEventListener("keydown", start);
                window.removeEventListener("touchstart", start);
            };
            window.addEventListener("pointerdown", start);
            window.addEventListener("keydown", start);
            window.addEventListener("touchstart", start);
            cleanup = remove;
        })();

        return () => cleanup();
    }, [autoPlay, play]);

    return (
        <button
            type="button"
            className={styles.bars}
            data-playing={playing}
            onClick={toggle}
            aria-pressed={playing}
            aria-label={playing ? "Stop music" : "Play music"}
        >
            {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={styles.bar} />
            ))}
            <audio ref={audioRef} src={src} loop={loop} preload="auto" />
        </button>
    );
}