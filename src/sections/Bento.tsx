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
  no: string;
  tag: string;
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
    no: '01',
    tag: 'Must-have',
    title: 'Live Study Rooms',
    copy: 'Sit at a virtual desk with other CMA US candidates — same part, same hour. Cameras optional, a shared timer keeps everyone in the same focused sprint.',
    bg: '#ea4467',
    ink: '#ffffff',
    span: 'md:col-span-7',
    Doodle: DoodleHeadphones,
    doodleTint: '#ffffff',
  },
  {
    no: '02',
    tag: 'Must-have',
    title: 'The Question Bank',
    copy: '9,700+ CMA US practice questions with worked explanations — quality-checked, section-mapped to the official syllabus, and growing weekly.',
    bg: '#e7fec7',
    ink: '#21221f',
    span: 'md:col-span-5',
    Doodle: DoodleBook,
    doodleTint: '#21221f',
  },
  {
    no: '03',
    tag: 'New format',
    title: 'CBQ Case Practice',
    copy: 'The exam’s newest question type, done right — short business cases with drag-and-drop, numeric and multi-select tasks, just like the real CMA US exam.',
    bg: '#d9e6f3',
    ink: '#21221f',
    span: 'md:col-span-5',
    Doodle: DoodleBulb,
    doodleTint: '#21221f',
  },
  {
    no: '04',
    tag: 'Must-have',
    title: 'AI Study Buddy',
    copy: 'Stuck at 1 AM before your exam? Ask the buddy. Patient answers with sources, drawn from the same bank you practice on — never just a guess.',
    bg: '#c6b3a2',
    ink: '#21221f',
    span: 'md:col-span-7',
    Doodle: DoodlePencil,
    doodleTint: '#21221f',
  },
  {
    no: '05',
    tag: 'Verified',
    title: 'Mentors & Mock Tests',
    copy: 'Verified CMA US mentors for the topics that need a human, plus full mock exams that feel like the real Prometric screen — including CBQ scoring.',
    bg: '#f3f1ee',
    ink: '#21221f',
    span: 'md:col-span-5',
    Doodle: DoodleBubble,
    doodleTint: '#21221f',
  },
  {
    no: '06',
    tag: 'Community',
    title: 'The Study Wall',
    copy: 'Notes, wins and questions from candidates on the same road. Share what finally clicked, and cheer strangers through exam week.',
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
          <p className="eyebrow mb-5 text-[#ea4467]">The CMA US toolkit</p>
          <h2
            data-bento-title
            className="slab-display max-w-xl text-[clamp(2.2rem,5vw,3.8rem)] t-ink"
          >
            Everything a CMA US candidate needs.
          </h2>
        </div>
        <p className="max-w-sm t-muted md:justify-self-end">
          Six tools, one roof — each one built for a moment in CMA US prep
          where candidates usually get stuck, distracted, or discouraged.
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
              <div className="mb-4 flex items-center gap-3">
                <span className="slab-display text-lg opacity-50">{c.no}</span>
                <span className="rounded-full border border-current px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] opacity-70">
                  {c.tag}
                </span>
              </div>
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
