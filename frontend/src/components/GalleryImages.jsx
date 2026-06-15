import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import styles from "./GalleryImages.module.css";

gsap.registerPlugin(Observer);

const NEXT = 1;
const PREV = -1;

/**
 * GalleryImages
 *
 * @param {Object[]} items            - slides to render
 * @param {string}   items[].image    - resolved image URL (e.g. cloudinary())
 * @param {string}   [items[].title]  - shown in the animated title line
 * @param {string}   [items[].description] - shown in the animated subtitle line
 * @param {string}   [items[].alt]    - accessible label for the image
 * @param {string}   [section]        - optional series label shown above the counter
 */
export default function GalleryImages({ items = [], section }) {
  const rootRef = useRef(null);
  const titleContainerRef = useRef(null);
  const descContainerRef = useRef(null);
  const linesContainerRef = useRef(null);
  const thumbsContainerRef = useRef(null);
  const currentSlideRef = useRef(null);
  const controllerRef = useRef(null);

  // Latest items available to imperative code without forcing the setup effect to re-run.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const hasDescriptions = items.some((it) => it && it.description);

  // The GSAP setup only re-runs when the actual images change (parent re-creates the
  // `items` array on every render, so we can't depend on its identity).
  const signature = items.map((it) => it && it.image).join("|");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const data = itemsRef.current;
    const slideCount = data.length;
    if (!slideCount) return undefined;

    const cleanups = [];
    const qa = (sel) => Array.from(root.querySelectorAll(sel));

    // --- collect rendered DOM ---------------------------------------------
    const slides = qa("." + styles.slide);
    const slidesInner = slides.map((s) => s.querySelector("." + styles.slideImg));
    const thumbs = qa("." + styles.slideThumb);

    // --- build the continuous drag-indicator lines ------------------------
    const linesContainer = linesContainerRef.current;
    if (linesContainer) {
      linesContainer.innerHTML = "";
      const totalLines = 60;
      for (let i = 0; i < totalLines; i++) {
        const line = document.createElement("div");
        line.className = styles.dragLine;
        linesContainer.appendChild(line);
      }
    }
    const lines = linesContainer
      ? Array.from(linesContainer.querySelectorAll("." + styles.dragLine))
      : [];

    // --- mutable runtime state (no re-render needed) ----------------------
    const state = {
      current: 0,
      animating: false,
      pending: null,
      currentHoveredThumb: null,
      mouseOverThumbnails: false,
      lastHoveredThumbIndex: null,
    };

    // --- initial visual state ---------------------------------------------
    slides.forEach((s, i) => s.classList.toggle(styles.slideCurrent, i === 0));
    if (thumbs[0]) thumbs[0].classList.add(styles.active);

    const setText = (container, baseClass, text) => {
      if (!container) return;
      const el = document.createElement("div");
      el.className = baseClass;
      el.textContent = text || "";
      container.appendChild(el);
    };
    setText(titleContainerRef.current, styles.slideTitle, data[0]?.title);
    if (descContainerRef.current) {
      setText(descContainerRef.current, styles.slideDesc, data[0]?.description);
    }

    // --- helpers ----------------------------------------------------------
    function updateNavigationUI(disabled) {
      qa("." + styles.counterNav).forEach((btn) => {
        btn.style.opacity = disabled ? "0.3" : "";
        btn.style.pointerEvents = disabled ? "none" : "";
      });
      thumbs.forEach((thumb) => {
        thumb.style.pointerEvents = disabled ? "none" : "";
      });
    }

    function updateSlideCounter(index) {
      if (currentSlideRef.current) {
        currentSlideRef.current.textContent = String(index + 1).padStart(2, "0");
      }
    }

    function swapText(container, baseClass, text) {
      if (!container) return;
      const old = container.querySelector("." + baseClass.split(" ")[0]);
      const next = document.createElement("div");
      next.className = baseClass + " " + styles.enterUp;
      next.textContent = text || "";
      container.appendChild(next);
      if (old) old.classList.add(styles.exitUp);

      // force reflow so the enter transition plays
      void next.offsetWidth;

      setTimeout(() => next.classList.remove(styles.enterUp), 10);
      setTimeout(() => {
        if (old && old.parentNode) old.remove();
      }, 500);
    }

    function updateTexts(index) {
      const item = itemsRef.current[index] || {};
      swapText(titleContainerRef.current, styles.slideTitle, item.title);
      if (descContainerRef.current) {
        swapText(descContainerRef.current, styles.slideDesc, item.description);
      }
    }

    function updateDragLines(activeIndex, forceUpdate = false) {
      if (!lines.length) return;

      const baseHeight =
        parseInt(
          getComputedStyle(root).getPropertyValue("--gi-line-base-height"),
          10
        ) || 15;

      // reset all lines to the resting state
      lines.forEach((line) => {
        line.style.height = "var(--gi-line-base-height)";
        line.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
      });

      if (activeIndex === null) return;

      // width-aware so the wave stays centered on the active thumb at any size
      const containerWidth = linesContainer ? linesContainer.clientWidth : 720;
      const lineCount = lines.length;
      const thumbWidth = containerWidth / slideCount;
      const centerPosition = (activeIndex + 0.5) * thumbWidth;
      const lineWidth = containerWidth / lineCount;
      const maxDistance = thumbWidth * 0.7;

      for (let i = 0; i < lineCount; i++) {
        const linePosition = (i + 0.5) * lineWidth;
        const distFromCenter = Math.abs(linePosition - centerPosition);
        if (distFromCenter > maxDistance) continue;

        const normalizedDist = distFromCenter / maxDistance;
        const waveHeight = Math.cos((normalizedDist * Math.PI) / 2);
        const height = baseHeight + waveHeight * 35;
        const opacity = 0.3 + waveHeight * 0.4;
        const delay = normalizedDist * 100;

        if (forceUpdate) {
          lines[i].style.height = `${height}px`;
          lines[i].style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
        } else {
          setTimeout(() => {
            if (
              state.currentHoveredThumb === activeIndex ||
              (state.mouseOverThumbnails &&
                state.lastHoveredThumbIndex === activeIndex)
            ) {
              lines[i].style.height = `${height}px`;
              lines[i].style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
            }
          }, delay);
        }
      }
    }

    // --- the shared transition (used by goTo + navigate) ------------------
    function transitionTo(index, direction) {
      state.animating = true;
      updateNavigationUI(true);

      const previous = state.current;
      state.current = index;

      thumbs.forEach((thumb, i) => thumb.classList.toggle(styles.active, i === index));
      updateSlideCounter(index);
      updateTexts(index);
      updateDragLines(index, true);

      const currentSlide = slides[previous];
      const currentInner = slidesInner[previous];
      const upcomingSlide = slides[index];
      const upcomingInner = slidesInner[index];

      gsap
        .timeline({
          onStart: () => {
            slides[index].classList.add(styles.slideCurrent);
            gsap.set(upcomingSlide, { zIndex: 99 });
          },
          onComplete: () => {
            slides[previous].classList.remove(styles.slideCurrent);
            gsap.set(upcomingSlide, { zIndex: 1 });

            state.animating = false;
            updateNavigationUI(false);

            if (state.pending) {
              const p = state.pending;
              state.pending = null;
              setTimeout(() => {
                if (p.type === "goto") controller.goTo(p.index);
                else controller.navigate(p.direction);
              }, 50);
            }

            if (state.mouseOverThumbnails && state.lastHoveredThumbIndex !== null) {
              state.currentHoveredThumb = state.lastHoveredThumbIndex;
              updateDragLines(state.lastHoveredThumbIndex, true);
            }
          },
        })
        .addLabel("start", 0)
        .fromTo(
          upcomingSlide,
          {
            autoAlpha: 1,
            scale: 0.1,
            yPercent: direction === 1 ? 100 : -100, // bottom for next, top for prev
          },
          { duration: 0.7, ease: "expo", scale: 0.4, yPercent: 0 },
          "start"
        )
        .fromTo(
          upcomingInner,
          {
            filter: "contrast(100%) saturate(100%)",
            transformOrigin: "100% 50%",
            scaleY: 4,
          },
          { duration: 0.7, ease: "expo", scaleY: 1 },
          "start"
        )
        .fromTo(
          currentInner,
          { filter: "contrast(100%) saturate(100%)" },
          {
            duration: 0.7,
            ease: "expo",
            filter: "contrast(120%) saturate(140%)",
          },
          "start"
        )
        .addLabel("middle", "start+=0.6")
        .to(upcomingSlide, { duration: 1, ease: "power4.inOut", scale: 1 }, "middle")
        .to(
          currentSlide,
          { duration: 1, ease: "power4.inOut", scale: 0.98, autoAlpha: 0 },
          "middle"
        );
    }

    // --- controller -------------------------------------------------------
    const controller = {
      goTo(index) {
        if (state.animating) {
          state.pending = { type: "goto", index };
          return false;
        }
        if (index === state.current) return false;
        transitionTo(index, index > state.current ? 1 : -1);
        return true;
      },
      navigate(direction) {
        if (state.animating) {
          state.pending = { type: "navigate", direction };
          return false;
        }
        const next =
          direction === 1
            ? state.current < slideCount - 1
              ? state.current + 1
              : 0
            : state.current > 0
            ? state.current - 1
            : slideCount - 1;
        transitionTo(next, direction);
        return true;
      },
      next() {
        this.navigate(NEXT);
      },
      prev() {
        this.navigate(PREV);
      },
    };
    controllerRef.current = controller;

    // --- thumbnail interactions (need access to `state`) ------------------
    thumbs.forEach((thumb, index) => {
      const onClick = () => {
        state.lastHoveredThumbIndex = index;
        controller.goTo(index);
      };
      const onEnter = () => {
        state.currentHoveredThumb = index;
        state.lastHoveredThumbIndex = index;
        state.mouseOverThumbnails = true;
        if (!state.animating) updateDragLines(index, true);
      };
      const onLeave = () => {
        if (state.currentHoveredThumb === index) state.currentHoveredThumb = null;
      };
      thumb.addEventListener("click", onClick);
      thumb.addEventListener("mouseenter", onEnter);
      thumb.addEventListener("mouseleave", onLeave);
      cleanups.push(() => {
        thumb.removeEventListener("click", onClick);
        thumb.removeEventListener("mouseenter", onEnter);
        thumb.removeEventListener("mouseleave", onLeave);
      });
    });

    // --- thumbnails area enter/leave --------------------------------------
    const thumbsArea = thumbsContainerRef.current;
    if (thumbsArea) {
      const onAreaEnter = () => {
        state.mouseOverThumbnails = true;
      };
      const onAreaLeave = () => {
        state.mouseOverThumbnails = false;
        state.currentHoveredThumb = null;
        updateDragLines(null);
      };
      thumbsArea.addEventListener("mouseenter", onAreaEnter);
      thumbsArea.addEventListener("mouseleave", onAreaLeave);
      cleanups.push(() => {
        thumbsArea.removeEventListener("mouseenter", onAreaEnter);
        thumbsArea.removeEventListener("mouseleave", onAreaLeave);
      });
    }

    // --- scroll / drag via GSAP Observer ----------------------------------
    const observer = Observer.create({
      target: root,
      type: "wheel,touch,pointer",
      onDown: () => {
        if (!state.animating) controller.prev();
      },
      onUp: () => {
        if (!state.animating) controller.next();
      },
      wheelSpeed: -1,
      tolerance: 10,
    });
    cleanups.push(() => observer.kill());

    // --- keyboard ---------------------------------------------------------
    const onKeyDown = (e) => {
      if (state.animating) return;
      if (e.key === "ArrowRight") controller.next();
      else if (e.key === "ArrowLeft") controller.prev();
    };
    window.addEventListener("keydown", onKeyDown);
    cleanups.push(() => window.removeEventListener("keydown", onKeyDown));

    // --- keep the wave centered on resize ---------------------------------
    const onResize = () => updateDragLines(state.current, true);
    window.addEventListener("resize", onResize);
    cleanups.push(() => window.removeEventListener("resize", onResize));

    // --- initial counters / lines -----------------------------------------
    updateSlideCounter(0);
    updateDragLines(0, true);

    // --- teardown ---------------------------------------------------------
    return () => {
      controllerRef.current = null;
      cleanups.forEach((fn) => fn());
      gsap.killTweensOf(slides);
      gsap.killTweensOf(slidesInner);
      if (linesContainer) linesContainer.innerHTML = "";
      if (titleContainerRef.current) titleContainerRef.current.innerHTML = "";
      if (descContainerRef.current) descContainerRef.current.innerHTML = "";
    };
  }, [signature]);

  return (
    <div className={styles.galleryRoot} ref={rootRef}>
      <div className={styles.scrollHint}>scroll or drag</div>

      <div className={styles.bottomUiContainer}>
        {section ? <div className={styles.slideSection}>{section}</div> : null}

        <div className={styles.slideCounter}>
          <div
            className={`${styles.counterNav} ${styles.prevSlide}`}
            onClick={() => controllerRef.current?.prev()}
          >
            ⟪
          </div>
          <div className={styles.counterDisplay}>
            <span className={styles.currentSlide} ref={currentSlideRef}>
              01
            </span>
            <span className={styles.counterDivider}>//</span>
            <span className={styles.totalSlides}>
              {String(items.length).padStart(2, "0")}
            </span>
          </div>
          <div
            className={`${styles.counterNav} ${styles.nextSlide}`}
            onClick={() => controllerRef.current?.next()}
          >
            ⟫
          </div>
        </div>

        <div className={styles.slideTitleContainer} ref={titleContainerRef} />
        {hasDescriptions ? (
          <div className={styles.slideDescContainer} ref={descContainerRef} />
        ) : null}

        <div className={styles.dragIndicator}>
          <div className={styles.linesContainer} ref={linesContainerRef} />
        </div>

        <div className={styles.thumbsContainer} ref={thumbsContainerRef}>
          <div className={styles.slideThumbs}>
            {items.map((item, i) => (
              <div
                key={i}
                className={styles.slideThumb}
                style={{ backgroundImage: `url(${item.image})` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.slides}>
        {items.map((item, i) => (
          <div className={styles.slide} key={i}>
            <div
              className={styles.slideBg}
              style={{ backgroundImage: `url(${item.image})` }}
              aria-hidden="true"
            />
            <div
              className={styles.slideImg}
              style={{ backgroundImage: `url(${item.image})` }}
              role="img"
              aria-label={item.alt || item.title || ""}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
