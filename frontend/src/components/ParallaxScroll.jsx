import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Snap from "lenis/snap";
import styles from "./ParallaxScroll.module.css";

gsap.registerPlugin(ScrollTrigger);

/* SVG text marquee — one per hero, scale-animated on scroll */
function Marquee({ label }) {
    return (
        <svg
            className={styles.marquee}
            viewBox="0 0 1200 200"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
            >
                {label}
            </text>
        </svg>
    );
}

export default function ParallaxScroll({ items }) {
    const wrapperRef = useRef(null);
    const contentRef = useRef(null);

    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        const content = contentRef.current;

        // GSAP and ScrollTrigger
        const lenis = new Lenis({
            infinite: true,
            wrapper: wrapper,
            content: content,
            syncTouch: true,
        });

        const snap = new Snap(lenis, {
            type: "mandatory",
            debounce: 500,
            duration: 0.9,
            easing: (t) => 1 - Math.pow(1 - t, 4),
        });

        ScrollTrigger.scrollerProxy(wrapper, {
            scrollTop(value) {
                // setter: ScrollTrigger wants to set scrollTop (for snapping, etc.)
                if (arguments.length) {
                    lenis.scrollTo(value, { immediate: true });
                } else {
                    // getter: ScrollTrigger wants current scrollTop
                    return lenis.scroll;
                }
            },
            getBoundingClientRect() {
                return {
                    top: 0,
                    left: 0,
                    width: wrapper.clientWidth,
                    height: wrapper.clientHeight,
                };
            },
            // Lenis generally plays nicest with transform pinning
            pinType: "transform",
        });

        const sections = wrapper.querySelectorAll("section");
        snap.addElements(sections, {
            align: "start",
        });

        lenis.on("scroll", ScrollTrigger.update);

        const tick = (time) => {
            lenis.raf(time * 1000);
        };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        // Section animations
        const ctx = gsap.context(() => {
            const heros = wrapper.querySelectorAll(`.${styles.hero}`);

            heros.forEach((hero) => {
                const image = hero.querySelector("picture");
                const marquees = hero.querySelectorAll("svg");

                // DRY Animation values
                const ANIMATION = {
                    IMAGE: {
                        before: -50,
                        after: 50,
                    },
                    MARQUEE: {
                        before: 1.5,
                        after: 0.5,
                    },
                };

                const SHARED_SETTINGS = {
                    ease: "none",
                    scrollTrigger: {
                        scroller: wrapper,
                        trigger: hero,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: true,
                        fastScrollEnd: true,
                    },
                };

                // Image Animation
                gsap.set(image, {
                    yPercent: ANIMATION.IMAGE.before,
                });
                gsap.fromTo(
                    image,
                    {
                        yPercent: ANIMATION.IMAGE.before,
                    },
                    {
                        yPercent: ANIMATION.IMAGE.after,
                        ...SHARED_SETTINGS,
                    }
                );

                // Marquee Scaling Animation
                marquees.forEach((marquee) => {
                    gsap.set(marquee, {
                        scale: ANIMATION.MARQUEE.before,
                    });
                    gsap.fromTo(
                        marquee,
                        {
                            scale: ANIMATION.MARQUEE.before,
                        },
                        {
                            scale: ANIMATION.MARQUEE.after,
                            ...SHARED_SETTINGS,
                        }
                    );
                });
            });
        }, wrapper);

        return () => {
            ctx.revert();
            gsap.ticker.remove(tick);
            snap.destroy();
            lenis.destroy();
        };
    }, []);

    // Real sections + duplicated first section for infinite scroll
    const loop = [
        ...items.map((item, i) => ({ item, key: `s-${i}`, clone: false })),
        { item: items[0], key: "clone-first", clone: true },
    ];

    return (
        <div ref={wrapperRef} className={styles.wrapper}>
            <div ref={contentRef} className={styles.content}>


                {loop.map(({ item, key, clone }) => (
                    <section
                        key={key}
                        className={styles.hero}
                        aria-hidden={clone || undefined}
                    >
                        <picture className={styles.heroImage}>
                            <img src={item.image} alt={clone ? "" : item.alt ?? ""} />
                        </picture>
                        <Marquee label={item.label ?? "SCROLL"} />
                    </section>
                ))}


            </div>
        </div>
    );
}