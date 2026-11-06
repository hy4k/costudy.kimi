import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { gsap, revealBatch } from '@/lib/anim';
import { DoodleCoffee, DoodlePeople } from '@/components/Doodles';

function InlineDoodle({ children, tint }: { children: ReactNode; tint: string }) {
  return (
    <span
      className={`mx-1 inline-block h-[0.8em] w-[0.8em] align-[-0.06em] ${tint} transition-transform duration-500 hover:rotate-[18deg]`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export default function Manifesto() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      revealBatch(gsap.utils.selector(ref)('[data-manifesto-fade]') as HTMLElement[], {
        stagger: 0.14,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative mx-auto max-w-5xl px-6 py-32 md:py-44">
      <p data-manifesto-fade className="eyebrow mb-8 text-center text-[#ea4467]">
        The idea
      </p>
      <h2
        data-manifesto-fade
        className="slab-display text-center text-[clamp(2.1rem,5.4vw,4rem)] leading-[1.12] t-ink"
      >
        The CMA US is hard
        <InlineDoodle tint="text-[#c6b3a2]">
          <DoodleCoffee className="h-full w-full" />
        </InlineDoodle>
        to study alone. It&rsquo;s easier
        <InlineDoodle tint="text-[#ea4467]">
          <DoodlePeople className="h-full w-full" />
        </InlineDoodle>
        together.
      </h2>
      <p
        data-manifesto-fade
        className="mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed t-muted"
      >
        CoStudy is one place where CMA US candidates sit side by side, even from
        different cities. Practice together, ask questions, share what worked —
        and keep going until you pass.
      </p>
    </section>
  );
}
