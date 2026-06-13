import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./MusicPlayer.module.css";

/**
 * MusicPlayer
 * -----------
 * Plays a song and shows an equalizer of bars that scale to the music in
 * real time (Web Audio FFT). Includes an on/off (play/pause) toggle.
 *
 * Props:
 *   src       (string, required)  Path/URL to the audio file, e.g. "/audio/track.mp3"
 *   title     (string)            Optional label shown next to the player
 *   barCount  (number)            How many equalizer bars (default 28)
 *   loop      (boolean)           Loop the track (default false)
 *
 * Notes:
 *   - Real frequency analysis needs the audio to be same-origin OR served with
 *     CORS headers (crossOrigin="anonymous" is set below). If the data comes
 *     back silent (cross-origin without CORS), the bars fall back to a smooth
 *     synthetic animation while playing, so they always move.
 *   - The first play() is triggered by the user's click, satisfying browser
 *     autoplay policies.
 */
export default function MusicPlayer({ src, title, barCount = 28, loop = false }) {
    const audioRef = useRef(null);
    const ctxRef = useRef(null);        // AudioContext
    const analyserRef = useRef(null);   // AnalyserNode
    const sourceRef = useRef(null);     // MediaElementSourceNode (created once)
    const dataRef = useRef(null);       // Uint8Array for FFT data
    const barRefs = useRef([]);
    const levelsRef = useRef(new Array(barCount).fill(0)); // smoothed heights
    const rafRef = useRef(0);

    const [playing, setPlaying] = useState(false);
    const [ready, setReady] = useState(false);

    const reduced =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Lazily build the audio graph on first play (needs a user gesture). */
    const ensureGraph = useCallback(() => {
        if (ctxRef.current) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return; // very old browser: audio still plays, bars stay synthetic
        const ctx = new AC();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;            // -> 64 frequency bins, plenty for bars
        analyser.smoothingTimeConstant = 0.8;
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination); // keep audio audible
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }, []);

    /* The visualizer loop. */
    const tick = useCallback(() => {
        const bars = barRefs.current;
        const levels = levelsRef.current;
        const analyser = analyserRef.current;
        const data = dataRef.current;

        let hasRealData = false;
        if (analyser && data) {
            analyser.getByteFrequencyData(data);
            for (let i = 0; i < data.length; i++) {
                if (data[i] !== 0) { hasRealData = true; break; }
            }
        }

        const now = performance.now() / 1000;
        for (let i = 0; i < bars.length; i++) {
            let target;
            if (hasRealData) {
                // Spread bars across the lower/mid bins (where music lives).
                const bin = Math.floor((i / bars.length) * (data.length * 0.7));
                target = data[bin] / 255; // 0..1
            } else {
                // Synthetic: layered sines so each bar moves differently.
                target =
                    0.35 +
                    0.32 * Math.sin(now * 6 + i * 0.55) +
                    0.18 * Math.sin(now * 11 + i * 0.9);
                target = Math.max(0.04, Math.min(1, target));
            }
            // Smooth toward target so bars don't flicker harshly.
            levels[i] += (target - levels[i]) * 0.35;
            const h = 0.06 + levels[i] * 0.94; // keep a tiny baseline
            if (bars[i]) bars[i].style.transform = `scaleY(${h.toFixed(3)})`;
        }
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const startLoop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    }, [tick]);

    const stopLoop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        // Ease bars back down to the baseline.
        const bars = barRefs.current;
        const levels = levelsRef.current;
        let frame = 0;
        const settle = () => {
            let moving = false;
            for (let i = 0; i < bars.length; i++) {
                levels[i] *= 0.8;
                if (levels[i] > 0.01) moving = true;
                const h = 0.06 + levels[i] * 0.94;
                if (bars[i]) bars[i].style.transform = `scaleY(${h.toFixed(3)})`;
            }
            if (moving && frame++ < 60) rafRef.current = requestAnimationFrame(settle);
        };
        settle();
    }, []);

    const toggle = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (playing) {
            audio.pause();
            return; // state flips via the 'pause' event handler
        }

        ensureGraph();
        if (ctxRef.current && ctxRef.current.state === "suspended") {
            await ctxRef.current.resume();
        }
        try {
            await audio.play();
        } catch {
            /* play() can reject if interrupted; the event handlers keep UI in sync */
        }
    }, [playing, ensureGraph]);

    /* Keep React state in sync with the actual media element + run the loop. */
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => {
            setPlaying(true);
            if (!reduced) startLoop();
        };
        const onPause = () => {
            setPlaying(false);
            stopLoop();
        };
        const onCanPlay = () => setReady(true);

        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onPause);
        audio.addEventListener("canplay", onCanPlay);

        return () => {
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onPause);
            audio.removeEventListener("canplay", onCanPlay);
            cancelAnimationFrame(rafRef.current);
            ctxRef.current?.close?.();
        };
    }, [reduced, startLoop, stopLoop]);

    const setBar = (i) => (el) => {
        barRefs.current[i] = el;
    };

    return (
        <div className={styles.player} data-playing={playing}>
            <button
                type="button"
                className={styles.toggle}
                onClick={toggle}
                disabled={!ready}
                aria-pressed={playing}
                aria-label={playing ? "Pause music" : "Play music"}
            >
                {playing ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </button>

            <div className={styles.bars} aria-hidden="true">
                {Array.from({ length: barCount }, (_, i) => (
                    <span key={i} ref={setBar(i)} className={styles.bar} />
                ))}
            </div>

            {title && <span className={styles.title}>{title}</span>}

            <audio
                ref={audioRef}
                src={src}
                loop={loop}
                preload="metadata"
                crossOrigin="anonymous"
            />
        </div>
    );
}
