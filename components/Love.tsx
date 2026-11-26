"use client";

import Mascot from "./Mascot";
import Testimonials from "./Testimonials";
import Icon from "./Icon";

/** The public page at /love: every approved testimonial, no sign-in needed. */
export default function Love() {
  return (
    <main className="love">
      <header className="love-top">
        <a className="love-brand" href="/" aria-label="Open Kwenta">
          <Icon name="back" size={18} /> Kwenta
        </a>
      </header>

      <div className="love-hero">
        <Mascot size={110} face="love" animated />
        <h1>What people say</h1>
        <p>Real words from people who track their money with Kwenta. Shared with permission, and names are hidden.</p>
      </div>

      <Testimonials title="Stories" empty={<p className="love-empty">No stories yet. Be the first to share how Kwenta helps you.</p>} />

      <a className="btn wide big love-cta" href="/">
        Open Kwenta
      </a>
      <p className="love-foot">Free · works offline · your data stays encrypted</p>
    </main>
  );
}
