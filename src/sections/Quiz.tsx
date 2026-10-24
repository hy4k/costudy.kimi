import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

type ModeKey = 'rooms' | 'buddy' | 'circle';

type Question = {
  q: string;
  answers: { text: string; note: string; mode: ModeKey }[];
};

const questions: Question[] = [
  {
    q: 'When does your brain actually show up?',
    answers: [
      { text: 'Early morning, before anyone is awake', note: 'Silence is your fuel.', mode: 'rooms' },
      { text: 'Late night, headphones on', note: 'The night desk it is.', mode: 'buddy' },
      { text: 'Whenever others are grinding too', note: 'You run on shared momentum.', mode: 'circle' },
    ],
  },
  {
    q: 'What usually breaks your study session?',
    answers: [
      { text: 'Zero structure — I never quite start', note: 'A room with a timer fixes that.', mode: 'rooms' },
      { text: 'A question nobody around can answer', note: 'Instant answers, patient pace.', mode: 'buddy' },
      { text: 'My phone, the fridge, the void', note: 'Company crowds out the void.', mode: 'circle' },
    ],
  },
  {
    q: 'Pick your ideal study Friday:',
    answers: [
      { text: 'Silent room, pomodoro sprints', note: 'Deep focus, held by others.', mode: 'rooms' },
      { text: 'Deep-diving one hard topic with a guide', note: 'A tutor was made for this.', mode: 'buddy' },
      { text: 'Brainstorming with the group', note: 'Ideas multiply in company.', mode: 'circle' },
    ],
  },
];

const results: Record<
  ModeKey,
  { name: string; feature: string; copy: string; bg: string; ink: string; to: string }
> = {
  rooms: {
    name: 'Sprint Room Regular',
    feature: 'Live Study Rooms',
    copy: 'Your focus feeds on quiet company. Claim a desk in a live room and let the shared timer carry you through deep-work sprints.',
    bg: '#ea4467',
    ink: '#ffffff',
    to: '/rooms',
  },
  buddy: {
    name: 'Night-Owl Researcher',
    feature: 'AI Study Buddy',
    copy: 'You go deep, at odd hours, and you want answers with sources. The buddy walks you to the answer one hint at a time — no judgment, no office hours.',
    bg: '#e7fec7',
    ink: '#21221f',
    to: '/ai',
  },
  circle: {
    name: 'Circle Keeper',
    feature: 'Study Wall',
    copy: 'You learn out loud. Broadcast insights, audit essays, chase bounties — and let the group hold your momentum.',
    bg: '#d9e6f3',
    ink: '#21221f',
    to: '/wall',
  },
};

export default function Quiz() {
  const [step, setStep] = useState(-1); // -1 intro, 0..2 questions, 3 result
  const [picked, setPicked] = useState<number | null>(null);
  const [winning, setWinning] = useState<ModeKey>('rooms');
  const scores = useRef<Record<ModeKey, number>>({ rooms: 0, buddy: 0, circle: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = useCallback(() => {
    scores.current = { rooms: 0, buddy: 0, circle: 0 };
    setPicked(null);
    setStep(0);
  }, []);

  const pick = useCallback((idx: number, mode: ModeKey) => {
    setPicked(idx);
    scores.current[mode] += 1;
    const isLast = step === questions.length - 1;
    timer.current = setTimeout(() => {
      if (isLast) {
        const s = scores.current;
        const winner: ModeKey =
          s.rooms >= s.buddy && s.rooms >= s.circle
            ? 'rooms'
            : s.buddy >= s.circle
              ? 'buddy'
              : 'circle';
        setWinning(winner);
        setStep(3);
      } else {
        setStep((v) => v + 1);
        setPicked(null);
      }
    }, 950);
  }, [step]);

  const result = results[winning];
  const current = questions[step];

  return (
    <section id="quiz" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-36">
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow mb-5 text-[#ea4467]">60-second sorting hat</p>
        <h2 className="slab-display text-[clamp(2.2rem,5vw,3.6rem)] t-ink">
          Find your study mode.
        </h2>
        <p className="mt-4 t-muted">
          Three honest questions. No wrong answers — only a desk with your
          name on it.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-2xl">
        {step === -1 && (
          <button
            onClick={start}
            className="group flex w-full items-center justify-between rounded-[1.6rem] border-[1.5px] b-line bg-white p-8 text-left transition-colors duration-300 hover:b-line"
          >
            <div>
              <p className="eyebrow t-faint">Ready when you are</p>
              <p className="slab-display mt-2 text-2xl t-ink md:text-3xl">
                Start the 3 questions
              </p>
            </div>
            <span className="pill-btn shrink-0 transition-transform duration-500 group-hover:-rotate-45">
              →
            </span>
          </button>
        )}

        {step >= 0 && step < 3 && current && (
          <div className="rounded-[1.6rem] border-[1.5px] b-line bg-white p-7 md:p-9">
            <div className="mb-7 flex items-center justify-between">
              <p className="eyebrow t-faint">
                Question {step + 1} / {questions.length}
              </p>
              <div className="flex gap-2" aria-hidden="true">
                {questions.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-6 rounded-full transition-colors duration-300 ${
                      i <= step ? 'bg-[#ea4467]' : 'bg-[var(--line)]'
                    }`}
                  />
                ))}
              </div>
            </div>

            <h3
              key={step}
              className="slab-display text-2xl t-ink md:text-[1.9rem]"
              style={{ animation: 'qIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              {current.q}
            </h3>

            <div className="mt-7 flex flex-col gap-3">
              {current.answers.map((a, i) => {
                const isPicked = picked === i;
                return (
                  <button
                    key={i}
                    onClick={() => pick(i, a.mode)}
                    disabled={picked !== null}
                    className={`quiz-answer group relative overflow-hidden rounded-xl border-[1.5px] px-5 py-4 text-left font-medium transition-all duration-300 ${
                      picked === null
                        ? 'b-line t-ink hover:-translate-y-0.5 hover:b-line'
                        : isPicked
                          ? 'translate-y-0 border-[#2b2926] bg-[#2b2926] text-[#fcfbfa]'
                          : 'b-line t-faint'
                    }`}
                  >
                    <span className="relative z-10 flex items-center justify-between gap-4">
                      {a.text}
                      <span
                        className={`text-sm transition-opacity duration-300 ${
                          isPicked ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        {a.note}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            className="overflow-hidden rounded-[1.6rem] p-8 md:p-10"
            style={{ backgroundColor: result.bg, color: result.ink, animation: 'qIn 0.6s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <p className="eyebrow opacity-70">Your mode</p>
            <h3 className="slab-display mt-3 text-3xl md:text-4xl">{result.name}</h3>
            <p className="mt-4 max-w-md leading-relaxed opacity-85">{result.copy}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                to={result.to}
                className="pill-btn !bg-[#2b2926] !text-[#fcfbfa] hover:!bg-[#21221f]"
              >
                Start with {result.feature}
              </Link>
              <button onClick={start} className="link-underline text-sm font-semibold opacity-80 hover:opacity-100">
                Retake the quiz
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes qIn {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
