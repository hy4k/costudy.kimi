import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import { gsap, revealBatch, revealSplit } from '@/lib/anim';
import { DoodlePaperPlane, DoodleSpark } from '@/components/Doodles';

const footerCols = [
  { head: 'Product', links: ['Live Rooms', 'The Feed', 'AI Buddy', 'Tutors', 'Library'] },
  { head: 'Community', links: ['Study Circles', 'Discussions', 'Ambassadors', 'Guidelines'] },
  { head: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
];

export default function Outro() {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref);
      q('[data-outro-title]').forEach((el) => revealSplit(el as HTMLElement));
      revealBatch(q('[data-outro-fade]') as HTMLElement[], { stagger: 0.1 });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <footer id="join" ref={ref} className="relative overflow-hidden">
      {/* final CTA */}
      <div className="relative mx-auto max-w-5xl px-6 py-32 text-center md:py-44">
        <DoodlePaperPlane
          className="pointer-events-none absolute left-[6%] top-[22%] w-16 rotate-[-14deg] t-muted md:w-24"
        />
        <DoodleSpark className="pointer-events-none absolute right-[8%] top-[30%] w-10 rotate-12 text-[#ea4467] md:w-14" />
        <DoodleSpark className="pointer-events-none absolute bottom-[18%] left-[16%] w-7 -rotate-12 text-[#c6b3a2] md:w-9" />

        <p data-outro-fade className="eyebrow mb-6 text-[#ea4467]">
          Join in
        </p>
        <h2
          data-outro-title
          className="slab-display mx-auto text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.95] t-ink"
        >
          Your desk is waiting.
        </h2>
        <p data-outro-fade className="mx-auto mt-6 max-w-md text-lg t-muted">
          Free to join. Bring your syllabus, your stubbornness, and maybe a
          friend.
        </p>
        <div data-outro-fade className="mt-10">
          <Link to="/rooms" className="pill-btn !px-9 !py-4 text-base">
            Claim your desk — it&rsquo;s free
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* footer */}
      <div className="border-t b-line">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="#top" className="font-slab text-xl font-bold t-ink">
              Co<span className="text-[#ea4467]">Study</span>
              <span className="ml-0.5 align-super text-[0.6em] font-medium t-muted">.in</span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed t-muted">
              The commons for collaborative learning. Made for students
              everywhere who refuse to study alone.
            </p>
          </div>
          {footerCols.map((col) => (
            <nav key={col.head} aria-label={col.head}>
              <p className="eyebrow mb-5 t-faint">{col.head}</p>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#top"
                      onClick={(e) => e.preventDefault()}
                      className="link-underline text-sm font-medium t-muted hover:t-ink"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t b-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs t-faint sm:px-8">
            <p>© 2026 CoStudy.in — a redesign concept.</p>
            <p>Built for learners, with warmth.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
