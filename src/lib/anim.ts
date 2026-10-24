import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Split an element's text into masked lines (word-wrapped, measured by
 * offsetTop) so each line can stagger up into view.
 */
export function splitLines(el: HTMLElement): HTMLElement[] {
  const words = (el.textContent ?? '').split(/\s+/).filter(Boolean);
  el.setAttribute('aria-label', el.textContent ?? '');
  el.innerHTML = words
    .map((w) => `<span class="sw" style="display:inline-block">${w}</span>`)
    .join(' ');

  const spans = Array.from(el.querySelectorAll<HTMLElement>('.sw'));
  const groups: HTMLElement[][] = [];
  let lastTop = Number.NaN;
  spans.forEach((s) => {
    if (s.offsetTop !== lastTop) {
      groups.push([]);
      lastTop = s.offsetTop;
    }
    groups[groups.length - 1].push(s);
  });

  el.innerHTML = '';
  const inners: HTMLElement[] = [];
  groups.forEach((group) => {
    const mask = document.createElement('span');
    mask.className = 'split-line';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'split-inner';
    group.forEach((w, i) => {
      if (i > 0) inner.appendChild(document.createTextNode(' '));
      inner.appendChild(w);
    });
    mask.appendChild(inner);
    el.appendChild(mask);
    el.appendChild(document.createTextNode(' '));
    inners.push(inner);
  });
  return inners;
}

/**
 * Animate a [data-split] headline: lines rise out of their masks on scroll.
 */
export function revealSplit(
  el: HTMLElement,
  opts: { delay?: number; stagger?: number } = {},
) {
  const inners = splitLines(el);
  if (reducedMotion()) {
    gsap.set(inners, { y: 0 });
    return;
  }
  gsap.to(inners, {
    y: 0,
    duration: 1.1,
    ease: 'power3.out',
    delay: opts.delay ?? 0,
    stagger: opts.stagger ?? 0.08,
    scrollTrigger: {
      trigger: el,
      start: 'top 85%',
      once: true,
    },
  });
}

/** Fade + rise a batch of elements as they enter the viewport. */
export function revealBatch(els: HTMLElement[], opts: { stagger?: number; y?: number } = {}) {
  if (!els.length) return;
  if (reducedMotion()) {
    gsap.set(els, { opacity: 1, y: 0 });
    return;
  }
  gsap.fromTo(
    els,
    { opacity: 0, y: opts.y ?? 28 },
    {
      opacity: 1,
      y: 0,
      duration: 0.9,
    ease: 'power3.out',
    stagger: opts.stagger ?? 0.09,
    scrollTrigger: {
      trigger: els[0],
      start: 'top 88%',
      once: true,
    },
  });
}

export { gsap, ScrollTrigger };
