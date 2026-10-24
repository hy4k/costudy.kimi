import { useLayoutEffect, useRef } from 'react';
import { gsap, revealBatch } from '@/lib/anim';

const items = [
  {
    title: 'Body doubling',
    copy: 'Simply having someone else work beside you steadies attention. Rooms make that presence ambient — no small talk required.',
  },
  {
    title: 'Shared momentum',
    copy: 'When the room sprints, you sprint. When the feed celebrates, you show up tomorrow. Progress is contagious by design.',
  },
  {
    title: 'Instant un-stuck',
    copy: 'A stuck question used to cost a whole evening. Now it costs four seconds — ask the buddy, or drop it in a circle.',
  },
  {
    title: 'Proof of progress',
    copy: 'Streaks, sessions and materials logged turn invisible effort into visible evidence. Motivation you can point at.',
  },
];

export default function Method() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      revealBatch(gsap.utils.selector(ref)('[data-method-row]') as HTMLElement[], {
        stagger: 0.12,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section id="method" ref={ref} className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 md:pb-36">
      <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-5 text-[#ea4467]">The method</p>
          <h2 className="slab-display text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1] t-ink">
            Why it
            <br />
            works.
          </h2>
        </div>
        <ol>
          {items.map((it, i) => (
            <li
              key={it.title}
              data-method-row
              className="grid gap-3 border-t b-line py-8 md:grid-cols-[72px_220px_1fr] md:gap-8"
            >
              <span className="slab-display text-3xl text-[#ea4467]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="slab-display text-xl t-ink md:text-2xl">{it.title}</h3>
              <p className="leading-relaxed t-muted">{it.copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
