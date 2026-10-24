import { useLayoutEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { gsap, revealBatch, revealSplit } from '@/lib/anim';
import {
  DoodleBook,
  DoodleBubble,
  DoodleBulb,
  DoodleHeadphones,
  DoodlePencil,
  DoodlePeople,
} from '@/components/Doodles';

type Card = {
  eyebrow: string;
  title: string;
  copy: string;
  bg: string;
  ink: string;
  span: string;
  Doodle: ComponentType<{ className?: string }>;
  doodleTint: string;
  doodleAccent?: string;
};

const cards: Card[] = [
  {
    eyebrow: 'Presence',
    title: 'Live Study Rooms',
    copy: 'Drop into a room, switch your camera on or off, and let the quiet company of others hold your focus. Timers, sprints and gentle accountability built in.',
    bg: '#ea4467',
    ink: '#ffffff',
    span: 'md:col-span-7',
    Doodle: DoodleHeadphones,
    doodleTint: '#ffffff',
  },
  {
    eyebrow: 'Social',
    title: 'The Feed',
    copy: 'Notes, wins and questions — a feed designed for learners, not lurkers. Share what clicked for you today.',
    bg: '#c6b3a2',
    ink: '#21221f',
    span: 'md:col-span-5',
    Doodle: DoodleBubble,
    doodleTint: '#21221f',
  },
  {
    eyebrow: 'Support',
    title: 'AI Study Buddy',
    copy: 'Stuck at 1 AM? Ask the buddy. Instant, patient answers that point you to sources — never just the answer.',
    bg: '#e7fec7',
    ink: '#21221f',
    span: 'md:col-span-5',
    Doodle: DoodleBulb,
    doodleTint: '#21221f',
  },
  {
    eyebrow: 'Humans',
    title: 'Expert Tutors',
    copy: 'For the subjects that need a person. Verified tutors, transparent rates, and sessions that fit around your timetable.',
    bg: '#d9e6f3',
    ink: '#21221f',
    span: 'md:col-span-7',
    Doodle: DoodlePencil,
    doodleTint: '#21221f',
  },
  {
    eyebrow: 'Materials',
    title: 'Resource Library',
    copy: 'Past papers, notes and decks shared by students — quality-checked and searchable by subject and exam board.',
    bg: '#f3f1ee',
    ink: '#21221f',
    span: 'md:col-span-5',
    Doodle: DoodleBook,
    doodleTint: '#21221f',
  },
  {
    eyebrow: 'Belonging',
    title: 'Community',
    copy: 'Discussion threads, study circles and exam-season moral support from a global dorm of people who get it.',
    bg: '#2b2926',
    ink: '#fcfbfa',
    span: 'md:col-span-7',
    Doodle: DoodlePeople,
    doodleTint: '#fcfbfa',
  },
];

export default function Bento() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref);
      q('[data-bento-title]').forEach((el) => revealSplit(el as HTMLElement));
      revealBatch(q('[data-bento-card]') as HTMLElement[], { stagger: 0.08 });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section id="toolkit" ref={ref} className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-36">
      <div className="mb-14 grid items-end gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow mb-5 text-[#ea4467]">The toolkit</p>
          <h2
            data-bento-title
            className="slab-display max-w-xl text-[clamp(2.2rem,5vw,3.8rem)] t-ink"
          >
            Everything you need to excel.
          </h2>
        </div>
        <p className="max-w-sm t-muted md:justify-self-end">
          Six tools, one roof. Each one exists because students told us exactly
          where studying breaks down.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {cards.map((c) => (
          <article
            key={c.title}
            data-bento-card
            className={`group relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[1.6rem] p-8 transition-transform duration-500 ease-out-soft hover:-translate-y-1.5 md:p-10 ${c.span}`}
            style={{ backgroundColor: c.bg, color: c.ink }}
          >
            <div className="relative z-10">
              <p className="eyebrow mb-4 opacity-70">{c.eyebrow}</p>
              <h3 className="slab-display text-2xl md:text-3xl">{c.title}</h3>
              <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed opacity-80">
                {c.copy}
              </p>
            </div>
            <c.Doodle
              className={`absolute -bottom-5 -right-5 h-32 w-32 rotate-6 opacity-90 transition-transform duration-700 ease-out-soft group-hover:-rotate-6 group-hover:scale-110 md:h-40 md:w-40`}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
