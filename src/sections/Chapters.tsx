import { useLayoutEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from '@/lib/anim';

const accents = ['#ea4467', '#6f9c3e', '#4a7fb5'];

const chapters = [
  {
    no: '01',
    title: 'The Quiet Room',
    copy: 'Cameras optional, presence guaranteed. Sit at a virtual desk where everyone is heads-down. A shared timer keeps the whole room in the same sprint — and when it rings, you all surface together.',
    stat: '2,148 desks occupied right now',
    bg: '#ea4467',
    ink: '#ffffff',
  },
  {
    no: '02',
    title: 'The Common Table',
    copy: 'The feed, but make it study. Post the diagram that finally made sense, ask the question you were embarrassed to ask in class, cheer a stranger through finals week. Learning, out loud.',
    stat: '41k notes shared this month',
    bg: '#e7fec7',
    ink: '#21221f',
  },
  {
    no: '03',
    title: 'The Night Desk',
    copy: 'When it is late and you are stuck, the AI buddy walks you to the answer — one hint at a time, with sources, at your pace. No judgment, no waiting for office hours.',
    stat: 'Answers in ~4 seconds, on average',
    bg: '#d9e6f3',
    ink: '#21221f',
  },
];

export default function Chapters() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref);
      q('[data-chapter]').forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 45%',
          onToggle: (self) => {
            if (self.isActive) setActive(i);
          },
        });
        gsap.from(el.querySelector('[data-chapter-inner]'), {
          opacity: 0,
          y: 60,
          scale: 0.97,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 80%', once: true },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section id="campus" ref={ref} className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-36">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-20">
        {/* sticky heading */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-5 text-[#ea4467]">The campus</p>
          <h2 className="slab-display text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.98] t-ink">
            One campus,
            <br />
            three{' '}
            <span
              className="transition-colors duration-500"
              style={{ color: accents[active] }}
            >
              rooms.
            </span>
          </h2>
          <p className="mt-6 max-w-sm t-muted">
            Move between them as your day shifts. Focus alone, together — then
            step out to talk it over.
          </p>
          <div className="mt-10 flex items-center gap-3" aria-hidden="true">
            {chapters.map((_, i) => (
              <span
                key={i}
                className="h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: active === i ? 32 : 10,
                  backgroundColor: active === i ? accents[i] : 'var(--line)',
                }}
              />
            ))}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] t-faint">
            {chapters[active].no} / 03 — {chapters[active].title}
          </p>
        </div>

        {/* scrolling chapters */}
        <div className="flex flex-col gap-6">
          {chapters.map((c) => (
            <article
              key={c.no}
              data-chapter
              className="flex min-h-[62vh] flex-col justify-between rounded-[1.8rem] p-9 md:p-12"
              style={{ backgroundColor: c.bg, color: c.ink }}
            >
              <div data-chapter-inner>
                <span className="slab-display block text-6xl opacity-25 md:text-7xl">
                  {c.no}
                </span>
                <h3 className="slab-display mt-8 text-3xl md:text-4xl">{c.title}</h3>
                <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed opacity-85">
                  {c.copy}
                </p>
              </div>
              <p
                className="mt-10 border-t pt-5 text-sm font-semibold uppercase tracking-[0.14em] opacity-75"
                style={{ borderColor: `${c.ink}30` }}
              >
                {c.stat}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
