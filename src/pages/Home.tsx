import { useEffect } from 'react';
import { Navigate } from 'react-router';
import Lenis from 'lenis';
import { gsap, ScrollTrigger, reducedMotion } from '@/lib/anim';
import Header from '@/components/Header';
import Hero from '@/sections/Hero';
import Manifesto from '@/sections/Manifesto';
import Bento from '@/sections/Bento';
import Pricing from '@/sections/Pricing';
import Method from '@/sections/Method';
import Outro from '@/sections/Outro';
import { useAuth } from '@/lib/authStore';

export default function Home() {
  const { profile, ready } = useAuth();

  useEffect(() => {
    if (reducedMotion()) return;

    const lenis = new Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    return () => {
      window.removeEventListener('load', onLoad);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  // signed-in students land on the note, not the marketing page
  if (ready && profile) return <Navigate to="/wall" replace />;

  return (
    <>
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#21221f] focus:px-5 focus:py-2 focus:text-sm focus:text-[#fcfbfa]"
      >
        Skip to content
      </a>
      <Header />
      <main>
        <Hero />
        <Manifesto />
        <Bento />
        <Pricing />
        <Method />
        <Outro />
      </main>
    </>
  );
}
