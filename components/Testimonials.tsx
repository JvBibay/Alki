"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchTestimonials, type Testimonial } from "@/lib/testimonials";
import { cloudConfigured } from "@/lib/supabase";
import Emoji from "./Emoji";

const EVERY_MS = 5000;

/**
 * Approved user quotes as a carousel: slides on its own, pauses when touched, swipes, and has arrows and dots.
 * Renders nothing when there are none (or offline), unless `empty` is given. `limit` shows a random subset.
 */
export default function Testimonials({ limit, title = "What people say", more, empty }: { limit?: number; title?: string; /** Show a link to the full /love page. */ more?: boolean; /** Shown when there are none (the quote areas elsewhere show nothing). */ empty?: ReactNode }) {
  const [list, setList] = useState<Testimonial[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cloudConfigured()) return setList([]);
    let alive = true;
    void fetchTestimonials().then((r) => alive && setList(r));
    return () => {
      alive = false;
    };
  }, []);

  // A different few each visit
  const shown = useMemo(() => (list && limit ? [...list].sort(() => Math.random() - 0.5).slice(0, limit) : list ?? []), [list, limit]);
  const count = shown.length;

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const n = el.children.length;
    const to = ((i % n) + n) % n;
    el.scrollTo({ left: to * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setIndex(to);
  }, []);

  // Keep the dots in step when the person swipes
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  // Slide on its own, unless paused, hidden, or the person prefers less motion
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) goTo(index + 1);
    }, EVERY_MS);
    return () => clearInterval(t);
  }, [count, paused, index, goTo]);

  if (list === null) return empty ? <p className="sub" style={{ textAlign: "center" }}>Loading…</p> : null;
  if (count === 0) return <>{empty ?? null}</>;

  return (
    <section
      className="testis"
      aria-roledescription="carousel"
      aria-label={title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <h2 className="testis-h">
        <Emoji e="💚" /> {title}
      </h2>
      <div className="testi-track" ref={track} onScroll={onScroll} tabIndex={0} aria-live={paused ? "polite" : "off"}>
        {shown.map((t, i) => (
          <figure className="testi" key={t.id} aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
            <figcaption>
              <span className="testi-av" aria-hidden="true">
                {t.author.charAt(0).toUpperCase()}
              </span>
              <span className="testi-who">
                <b>{t.author}</b>
                <small>Kwenta user</small>
              </span>
            </figcaption>
            <blockquote>{t.message}</blockquote>
          </figure>
        ))}
      </div>
      {count > 1 && (
        <div className="testi-nav">
          <button className="testi-arrow" onClick={() => goTo(index - 1)} aria-label="Previous story">
            ‹
          </button>
          {count <= 8 ? (
            <div className="testi-dots">
              {shown.map((t, i) => (
                <button key={t.id} className={i === index ? "on" : ""} onClick={() => goTo(i)} aria-label={`Go to story ${i + 1}`} aria-current={i === index} />
              ))}
            </div>
          ) : (
            <span className="testi-count">
              {index + 1} / {count}
            </span>
          )}
          <button className="testi-arrow" onClick={() => goTo(index + 1)} aria-label="Next story">
            ›
          </button>
        </div>
      )}
      {more && (
        <a className="link" href="/love">
          See all stories ›
        </a>
      )}
    </section>
  );
}
