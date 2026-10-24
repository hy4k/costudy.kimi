import { useLayoutEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { gsap, revealSplit, reducedMotion } from '@/lib/anim';
import {
  DoodleBook,
  DoodleBubble,
  DoodleBulb,
  DoodleClock,
  DoodleCoffee,
  DoodleHeadphones,
  DoodleNote,
  DoodlePencil,
  DoodleSpark,
} from '@/components/Doodles';

type Scatter = {
  Comp: ComponentType<{ className?: string }>;
  cls: string;
  depth: number;
  speed: number;
};

const scatter: Scatter[] = [
  { Comp: DoodleBook, cls: 'left-[4%] top-[16%] w-24 md:w-28 -rotate-[10deg]', depth: 1.0, speed: 0.35 },
  { Comp: DoodleCoffee, cls: 'right-[6%] top-[14%] w-20 md:w-24 rotate-[9deg]', depth: 0.7, speed: 0.55 },
  { Comp: DoodleBubble, cls: 'left-[10%] bottom-[18%] w-28 md:w-32 rotate-[6deg]', depth: 0.85, speed: 0.8 },
  { Comp: DoodleBulb, cls: 'right-[13%] bottom-[22%] w-16 md:w-20 -rotate-[8deg]', depth: 1.2, speed: 0.45 },
  { Comp: DoodlePencil, cls: 'left-[28%] top-[7%] w-12 md:w-16 rotate-[16deg] hidden md:block', depth: 0.5, speed: 1.0 },
  { Comp: DoodleClock, cls: 'right-[30%] top-[5%] w-14 md:w-20 -rotate-[12deg] hidden md:block', depth: 0.6, speed: 0.7 },
  { Comp: DoodleNote, cls: 'left-[38%] bottom-[6%] w-14 md:w-20 rotate-[5deg] hidden md:block', depth: 0.45, speed: 1.15 },
  { Comp: DoodleHeadphones, cls: 'right-[36%] bottom-[4%] w-20 md:w-28 rotate-[10deg] hidden md:block', depth: 0.55, speed: 0.9 },
  { Comp: DoodleSpark, cls: 'left-[19%] top-[44%] w-8 md:w-10 rotate-[14deg]', depth: 1.35, speed: 0.3 },
  { Comp: DoodleSpark, cls: 'right-[20%] top-[52%] w-6 md:w-8 -rotate-[10deg]', depth: 1.15, speed: 0.6 },
];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    let onMove: ((e: MouseEvent) => void) | null = null;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref);

      // wordmark + copy reveal
      q('[data-split]').forEach((el) => revealSplit(el as HTMLElement));
      gsap.from('[data-hero-fade]', {
        opacity: 0,
        y: 26,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.25,
      });

      // doodle entrance + idle float
      if (!reducedMotion()) {
        gsap.from('[data-doodle]', {
          opacity: 0,
          scale: 0.5,
          y: 30,
          duration: 0.9,
          ease: 'back.out(1.6)',
          stagger: 0.07,
          delay: 0.15,
        });
        q('[data-doodle] svg').forEach((svg) => {
          gsap.to(svg, {
            y: '-=7',
            rotation: '+=2.5',
            duration: 2.6 + Math.random() * 1.4,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          });
        });

        // layered scroll parallax — each doodle drifts at its own speed
        q('[data-doodle]').forEach((el) => {
          const speed = parseFloat((el as HTMLElement).dataset.speed || '0.5');
          gsap.to(el, {
            yPercent: -speed * 38,
            ease: 'none',
            scrollTrigger: {
              trigger: ref.current,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
        });

        // mouse parallax — deeper doodles follow the cursor further
        const fine = window.matchMedia('(pointer: fine)').matches;
        if (fine) {
          const movers = q('[data-doodle]').map((el) => ({
            depth: parseFloat((el as HTMLElement).dataset.depth || '0.5'),
            xTo: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }),
            yTo: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }),
          }));
          onMove = (e: MouseEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            movers.forEach((m) => {
              m.xTo(nx * m.depth * 34);
              m.yTo(ny * m.depth * 34);
            });
          };
          window.addEventListener('mousemove', onMove);
        }
      }
    }, ref);
    return () => {
      if (onMove) window.removeEventListener('mousemove', onMove);
      ctx.revert();
    };
  }, []);

  return (
    <section id="top" ref={ref} className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      {/* faint dot grid backdrop */}
      <div
        className="dotgrid pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{ backgroundSize: '26px 26px' }}
        aria-hidden="true"
      />

      {/* scattered doodles */}
      {scatter.map((s, i) => (
        <div
          key={i}
          data-doodle
          data-depth={s.depth}
          data-speed={s.speed}
          className={`pointer-events-none absolute t-ink ${s.cls}`}
          aria-hidden="true"
        >
          <s.Comp className="h-auto w-full drop-shadow-[0_6px_0_rgba(33,34,31,0.06)]" />
        </div>
      ))}

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <p data-hero-fade className="eyebrow mb-6 text-[#ea4467]">
          Drop in · Study together
        </p>
        <h1
          data-split
          className="slab-display mx-auto text-[clamp(4.2rem,17vw,12.5rem)] t-ink"
        >
          CoStudy.
        </h1>
        <p data-hero-fade className="mx-auto mt-7 max-w-xl text-lg leading-relaxed t-muted md:text-xl">
          The commons where students meet to learn — live rooms, a social feed,
          verified tutors and an AI buddy, all in one warm place.
        </p>
        <div data-hero-fade className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/rooms" className="pill-btn">
            Claim your desk
            <span aria-hidden="true">→</span>
          </Link>
          <a href="#campus" className="pill-btn pill-btn--ghost">
            Wander the campus
          </a>
        </div>
      </div>

      {/* scroll cue */}
      <div
        data-hero-fade
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 t-faint"
        aria-hidden="true"
      >
        <div className="mx-auto h-10 w-px overflow-hidden bg-[var(--line)]">
          <div className="h-4 w-px animate-[cue_1.6s_ease-in-out_infinite] bg-[var(--ink)]" />
        </div>
        <style>{`@keyframes cue { 0%{transform:translateY(-100%)} 100%{transform:translateY(300%)} }`}</style>
      </div>
    </section>
  );
}
