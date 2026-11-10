import { useCallback, useEffect, useRef, useState } from 'react';
import { DoodleNote, DoodleSpark } from '@/components/Doodles';
import { supabase } from '@/lib/supabase';

type Stroke = {
  id: string;
  color: string;
  width: number;
  points: [number, number][]; // normalized 0..1 so every screen draws the same
};

const INKS = ['#21221f', '#ea4467', '#2f6fed', '#6f9c3e'];

export default function RoomWhiteboard({ roomId }: { roomId: string }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [ink, setInk] = useState(INKS[1]);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const lastWrite = useRef<string>('');

  // initial load
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('room_whiteboards')
      .select('strokes')
      .eq('room_id', roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setStrokes((data as { strokes: Stroke[] }).strokes || []);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // live sync — other desks' strokes arrive as they finish them
  useEffect(() => {
    const channel = supabase
      .channel(`board-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_whiteboards', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { strokes?: Stroke[]; updated_at?: string };
          if (!row?.strokes) return;
          if (row.updated_at && row.updated_at === lastWrite.current) return; // own echo
          setStrokes(row.strokes);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // paint
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const all = drawing.current ? [...strokes, drawing.current] : strokes;
    for (const s of all) {
      if (s.points.length < 2) {
        if (s.points.length === 1) {
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(s.points[0][0] * w, s.points[0][1] * h, (s.width || 3) / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0][0] * w, s.points[0][1] * h);
      for (const [x, y] of s.points.slice(1)) ctx.lineTo(x * w, y * h);
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    paint();
    const ro = new ResizeObserver(() => paint());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [paint]);

  const persist = async (next: Stroke[]) => {
    setSaving(true);
    const now = new Date().toISOString();
    lastWrite.current = now;
    const { error } = await supabase
      .from('room_whiteboards')
      .upsert({ room_id: roomId, strokes: next, updated_at: now });
    setSaving(false);
    if (error) {
      // row may not exist yet and RLS blocked insert — surface quietly, strokes stay local
      console.warn('whiteboard save failed', error.message);
    }
  };

  const pos = (e: React.PointerEvent): [number, number] => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { id: crypto.randomUUID(), color: ink, width: 3, points: [pos(e)] };
    paint();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current.points.push(pos(e));
    paint();
  };
  const up = () => {
    const s = drawing.current;
    drawing.current = null;
    if (!s) return;
    const next = [...strokes, s];
    setStrokes(next);
    void persist(next);
  };

  const clear = () => {
    const next: Stroke[] = [];
    setStrokes(next);
    void persist(next);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b b-line px-6 py-3">
        <DoodleNote className="h-5 w-5 text-[var(--coral)]" />
        <p className="eyebrow t-faint">Shared whiteboard</p>
        <span className="text-xs t-faint">· {strokes.length} strokes · live for the room</span>
        <div className="ml-auto flex items-center gap-1.5">
          {INKS.map((c) => (
            <button
              key={c}
              onClick={() => setInk(c)}
              aria-label={`Ink ${c}`}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                ink === c ? 'scale-110 border-[var(--ink)]' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            onClick={clear}
            disabled={strokes.length === 0}
            className="ml-2 rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-[0.65rem] font-bold tracking-wide t-muted transition-colors hover:t-ink disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="relative flex-1" style={{ minHeight: '46vh' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="absolute inset-0 cursor-crosshair touch-none"
        />
        {strokes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs font-semibold t-faint">
            Sketch a formula, a framework, a plan — everyone at a desk sees it live.
          </p>
        )}
      </div>
      <p className="flex items-center gap-2 border-t b-line px-6 py-3 text-[0.65rem] t-faint">
        <DoodleSpark className="h-3.5 w-3.5" />
        {saving ? 'Saving to the room…' : 'Every finished stroke syncs to the room in real time.'}
      </p>
    </div>
  );
}
