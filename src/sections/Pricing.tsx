import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import { gsap, revealBatch, revealSplit } from '@/lib/anim';
import { DoodleSpark } from '@/components/Doodles';

type Plan = {
  name: string;
  blurb: string;
  price: string;
  per: string;
  note?: string;
  features: { text: string; note?: string; off?: boolean }[];
  bg: string;
  ink: string;
  accent: boolean;
  cta: string;
};

const plans: Plan[] = [
  {
    name: 'Free',
    blurb: 'Perfect to get started',
    price: '₹0',
    per: 'forever',
    features: [
      { text: 'Live Study Rooms', note: 'unlimited' },
      { text: 'AI Study Buddy', note: '20 questions/day' },
      { text: 'MCQ Practice', note: '10 questions/day' },
      { text: 'Study Wall & community', note: 'full access' },
      { text: 'CBQ Case Practice', off: true },
      { text: 'Full question bank', off: true },
      { text: 'Mock test simulations', off: true },
    ],
    bg: '#f3f1ee',
    ink: '#21221f',
    accent: false,
    cta: 'Start free',
  },
  {
    name: 'Pro',
    blurb: 'Everything you need to pass',
    price: '₹333',
    per: '/ month',
    note: 'Billed ₹3,999/year',
    features: [
      { text: 'Live Study Rooms', note: 'unlimited' },
      { text: 'AI Study Buddy', note: 'unlimited' },
      { text: 'MCQ Practice', note: 'unlimited · 9,700+ bank' },
      { text: 'CBQ Case Practice', note: 'interactive, exam-style' },
      { text: 'Full mock exams', note: 'real exam feel' },
      { text: 'Progress analytics', note: 'weak-area tracking' },
      { text: 'Priority support', note: '7-day free trial' },
    ],
    bg: '#21221f',
    ink: '#fcfbfa',
    accent: true,
    cta: 'Go Pro — free for 7 days',
  },
];

export default function Pricing() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref);
      q('[data-plans-title]').forEach((el) => revealSplit(el as HTMLElement));
      revealBatch(q('[data-plan-card]') as HTMLElement[], { stagger: 0.12 });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section id="plans" ref={ref} className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-36">
      <div className="mb-14 text-center">
        <p className="eyebrow mb-5 text-[#ea4467]">Simple plans for CMA US prep</p>
        <h2
          data-plans-title
          className="slab-display mx-auto text-[clamp(2.2rem,5vw,3.8rem)] t-ink"
        >
          Choose your intensity.
        </h2>
        <p className="mx-auto mt-4 max-w-md t-muted">
          Start free, upgrade when you&rsquo;re ready to go all in. No hidden
          fees, cancel anytime.
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <article
            key={p.name}
            data-plan-card
            className={`relative flex flex-col overflow-hidden rounded-[1.8rem] p-9 md:p-11 ${
              p.accent ? 'shadow-[10px_10px_0_0_#ea4467]/25' : 'b-line border-[1.5px]'
            }`}
            style={{ backgroundColor: p.bg, color: p.ink }}
          >
            {p.accent && (
              <span className="absolute right-8 top-8 rounded-full bg-[#ea4467] px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white">
                Recommended
              </span>
            )}
            <DoodleSpark
              className={`pointer-events-none absolute -bottom-4 -right-4 w-24 rotate-12 md:w-28 ${
                p.accent ? 'text-[#fcfbfa]/10' : 'text-[#21221f]/5'
              }`}
            />

            <h3 className="slab-display text-3xl">{p.name}</h3>
            <p className="mt-1 text-sm italic opacity-70">{p.blurb}</p>

            <div className="mt-8">
              <span className="slab-display text-5xl md:text-6xl">{p.price}</span>{' '}
              <span className="text-lg opacity-60">{p.per}</span>
              {p.note && (
                <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#ea4467]">
                  {p.note}
                </p>
              )}
            </div>

            <ul className="mt-9 flex-1 space-y-3.5">
              {p.features.map((f) => (
                <li
                  key={f.text}
                  className={`flex items-baseline gap-2.5 text-sm font-semibold ${
                    f.off ? 'opacity-35 line-through' : ''
                  }`}
                >
                  <span className={`text-xs ${p.accent ? 'text-[#ea4467]' : 'text-[#6f9c3e]'}`}>
                    {f.off ? '—' : '✓'}
                  </span>
                  <span>
                    {f.text}
                    {f.note && <span className="ml-1 text-xs font-normal opacity-60">({f.note})</span>}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              to="/login?mode=signup"
              className={`mt-10 block rounded-full px-6 py-3.5 text-center text-sm font-bold tracking-wide transition-transform duration-300 hover:-translate-y-0.5 ${
                p.accent
                  ? 'bg-[#ea4467] text-white'
                  : 'bg-[#21221f] text-[#fcfbfa]'
              }`}
            >
              {p.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
