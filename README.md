# CoStudy.in — Redesign Concept

A warm, craft-driven redesign of [costudy.in](https://costudy.in), a CMA US exam-prep
ecosystem. The concept: instead of a generic SaaS look, CoStudy becomes **"the study
commons"** — an earthy, hand-drawn, editorial space where studying alone turns into
studying together.

![stack](https://img.shields.io/badge/React-19-61dafb) ![stack](https://img.shields.io/badge/Vite-7-a855f7) ![stack](https://img.shields.io/badge/Tailwind-3.4-38bdf8) ![stack](https://img.shields.io/badge/GSAP-3-0ae448)

## What's inside

**Landing experience** (`/`)
- Scattered hand-drawn study doodles around a giant slab-serif wordmark — each with its
  own idle float, scroll parallax speed, and cursor depth
- Manifesto, asymmetric bento toolkit, sticky "One campus, three rooms" chapters with a
  shifting accent, an interactive **"Find your study mode"** quiz, numbered method list
- Lenis smooth scroll + GSAP split-line text reveals; reduced-motion support throughout

**Night-desk dark mode** — token-based theming with a warm espresso palette, toggled by a
hand-drawn sun/moon switch (header + app sidebar), persisted to localStorage.

**Inner app pages** (grounded in the real product's modules)
| Route | Page | Highlights |
| --- | --- | --- |
| `/rooms` | Study Rooms | Live clusters, Part 1/2 filters, desk occupancy, working shared pomodoro |
| `/wall` | Study Wall | Real post taxonomy (MCQ, Peer Audit, Bounty…), playable MCQs, signal levels, Academic Radar bookmarks |
| `/vault` | Library Vault | Search + kind filters, verified/pending quality-check badges, pin-to-deck |
| `/ai` | AI Deck | CMA mentor chat with typewriter answers, formula cards, study visuals; consumes Vault pins |
| `/path` | Mastery Path | "The cockpit": mastery ring, syllabus blocks, mock trend vs the 360 pass mark, streaks |

## Run it

```bash
npm install
npm run dev
```

## Stack

React 19 · TypeScript · Vite · Tailwind CSS · GSAP (ScrollTrigger) · Lenis · react-router

All imagery is code-drawn SVG — no stock photos, no icon fonts.
