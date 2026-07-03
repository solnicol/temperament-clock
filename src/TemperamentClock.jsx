import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ————— Circle of fifths, clockwise from 12 o'clock —————
// Labels are pitch classes ordered by fifths, modulo the octave.
// Face taps always play 12-TET octave-folded representatives; the literal
// pure-fifth chain only sounds during "climb the spiral".
//
// In pure tuning, twelve stacked fifths do not close:
// (3/2)^12 overshoots 2^7 by the Pythagorean comma, about 23.46 cents.
// 12-TET turns the non-closing pure-fifths spiral into a closed 12-step clock
// by flattening each fifth equally. (Other temperaments close the circle by
// distributing or localising the comma differently; equal division is one solution.)

const A4 = 440;
const etFreqOf = (semitonesFromA4) => A4 * Math.pow(2, semitonesFromA4 / 12);

const NOTES = [
  { label: "C",  sub: null, rel: "Am",  semitoneFromA4: -9, sig: "no sharps or flats", hour: 12 },
  { label: "G",  sub: null, rel: "Em",  semitoneFromA4: -2, sig: "1 sharp",  hour: 1 },
  { label: "D",  sub: null, rel: "Bm",  semitoneFromA4: -7, sig: "2 sharps", hour: 2 },
  { label: "A",  sub: null, rel: "F♯m", semitoneFromA4:  0, sig: "3 sharps", hour: 3 },
  { label: "E",  sub: null, rel: "C♯m", semitoneFromA4: -5, sig: "4 sharps", hour: 4 },
  { label: "B",  sub: null, rel: "G♯m", semitoneFromA4:  2, sig: "5 sharps", hour: 5 },
  { label: "F♯", sub: "G♭", rel: "D♯m", semitoneFromA4: -3, sig: "6 sharps / 6 flats", hour: 6 },
  { label: "D♭", sub: "C♯", rel: "B♭m", semitoneFromA4: -8, sig: "5 flats",  hour: 7 },
  { label: "A♭", sub: null, rel: "Fm",  semitoneFromA4: -1, sig: "4 flats",  hour: 8 },
  { label: "E♭", sub: null, rel: "Cm",  semitoneFromA4: -6, sig: "3 flats",  hour: 9 },
  { label: "B♭", sub: null, rel: "Gm",  semitoneFromA4:  1, sig: "2 flats",  hour: 10 },
  { label: "F",  sub: null, rel: "Dm",  semitoneFromA4: -4, sig: "1 flat",   hour: 11 },
].map((note) => ({ ...note, etFreq: etFreqOf(note.semitoneFromA4) }));

// Spiral tour: literal ascending pure fifths from C2.
// Each step multiplies by exactly 3/2, so twelve steps overshoot seven octaves
// by the Pythagorean comma — the spiral never closes back on C.
const C2 = 65.406;
const spiralFreqOf = (fifthSteps) => C2 * Math.pow(3 / 2, fifthSteps);

// The app teaches from its own maths: these are computed, not quoted.
const centsOf = (ratio) => 1200 * Math.log2(ratio);
const PYTHAGOREAN_COMMA_RATIO = Math.pow(3 / 2, 12) / Math.pow(2, 7); // ≈ 1.01364
const PYTHAGOREAN_COMMA_CENTS = centsOf(PYTHAGOREAN_COMMA_RATIO);      // ≈ 23.46
const ET_FIFTH_FLATTENING_CENTS = centsOf(3 / 2) - 700;                // ≈ 1.955

// Sustained-fifth lab: the audible case for temperament. A pure fifth's
// harmonics coincide (3×C4 = 2×G4 exactly); the tempered fifth's miss by a
// hair, and that near-miss is heard — and shown — as a slow beat.
const C4_FREQ = etFreqOf(-9);
const G4_ET = etFreqOf(-2);
const BEAT_HZ = Math.abs(3 * C4_FREQ - 2 * G4_ET); // ≈ 0.886
const BEAT_PERIOD_S = 1 / BEAT_HZ;                  // ≈ 1.129

// Palette in OKLCH (perceptually uniform; animations below move only L/C).
const BRASS = "oklch(0.728 0.138 89.7)";
const INK = "oklch(0.925 0.007 88.6)";
const DIM = "oklch(0.524 0.006 95.2)";
const FAINT = "oklch(0.286 0.004 286.2)";
const BG = "oklch(0.164 0.002 286.2)";
const BTN_BORDER = "oklch(0.349 0.003 286.2)";

// Spelling along the literal fifth chain (spiral tour). Step 7 is C♯, not D♭ —
// the face keeps the key-signature spelling; the chain keeps its own.
const FIFTH_CHAIN_LABELS = [
  "C", "G", "D", "A", "E", "B", "F♯", "C♯", "G♯", "D♯", "A♯", "E♯/F", "B♯ (≈C)",
];

const CAPTIONS = {
  idle: `Tap any note to hear its 12-TET pitch · the breathing dot marks the hour`,
  circle: `Twelve fifths, each tempered ${ET_FIFTH_FLATTENING_CENTS.toFixed(2)}¢ narrow of pure 3:2 — the thread closes because every step absorbs its share of the comma.`,
  spiral: `Twelve pure 3:2 fifths rising from C2 overshoot seven octaves by ${PYTHAGOREAN_COMMA_CENTS.toFixed(2)}¢ — the thread misses its start by the Pythagorean comma.`,
  pure: `Pure fifth · 3:2 — the third harmonic of C lands exactly on the second harmonic of G. The sound locks.`,
  tempered: `Tempered fifth · 2^(7/12) — those harmonics miss by ${BEAT_HZ.toFixed(2)} Hz. The slow beat you hear (and see) is the price of a circle that closes.`,
};

export default function TemperamentClock() {
  const [now, setNow] = useState(() => new Date());
  const [soundOn, setSoundOn] = useState(false);
  const [activeIdx, setActiveIdx] = useState(null);   // face position (mod 12)
  const [activeStep, setActiveStep] = useState(null); // absolute chain step (0–12)
  const [touring, setTouring] = useState(false);
  const [tourAnim, setTourAnim] = useState(null); // { mode, startedAt } while the tour thread is on screen
  const [tourNow, setTourNow] = useState(0);
  const [lastTour, setLastTour] = useState(null); // caption persists after a tour ends
  const [dyad, setDyad] = useState(null); // null | "pure" | "tempered"
  const audioCtxRef = useRef(null);
  const dyadNodesRef = useRef(null);
  const lastHourRef = useRef(null);
  // Sync the CSS-driven second hand to real time once at mount.
  const secOffsetRef = useRef((Date.now() / 1000) % 60);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // The second hand sweeps via CSS, so the render clock only needs to keep
  // the digital readout and minute/hour hands honest — 4 Hz, not 60.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(id);
  }, []);

  // The tour thread animates per-frame, but only while a tour is on screen.
  useEffect(() => {
    if (!tourAnim || reducedMotion.current) return;
    let raf;
    const loop = () => {
      setTourNow(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tourAnim]);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Master limiter: overlapping strikes sum their gains, and anything
      // past 0 dBFS clips harshly. A hard-ratio compressor before the
      // destination catches spikes gracefully instead.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.005;
      limiter.connect(ctx.destination);
      audioCtxRef.current = { ctx, destination: limiter };
    }
    if (audioCtxRef.current.ctx.state === "suspended") {
      audioCtxRef.current.ctx.resume();
    }
    return audioCtxRef.current;
  }, []);

  // If the component unmounts mid-tour, scheduled oscillators would keep
  // ringing on the audio thread. Shut the engine down with the component.
  useEffect(() => {
    return () => {
      if (audioCtxRef.current?.ctx) {
        audioCtxRef.current.ctx.close();
      }
    };
  }, []);

  // fifthSteps: position in fifths order (0 = C). "et" indexes the
  // octave-folded pitch class; "spiral" exponentiates a true 3:2.
  const freqFor = useCallback(
    (idx, mode) => (mode === "spiral" ? spiralFreqOf(idx) : NOTES[idx].etFreq),
    []
  );

  const strike = useCallback(
    (idx, when = 0, dur = 2.4, mode = "et") => {
      const { ctx, destination } = getCtx();
      const t = ctx.currentTime + when;
      const f = freqFor(idx, mode);
      const master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(destination);
      const partials = [
        { ratio: 1, gain: 0.5 },
        { ratio: 2.0, gain: 0.18 },
        { ratio: 2.98, gain: 0.09 },
        { ratio: 4.2, gain: 0.04 },
      ].filter((p) => f * p.ratio < 12000); // drop very high partials that turn harsh up the spiral
      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f * p.ratio;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(p.gain, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1 - p.ratio * 0.12));
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + dur);
      });
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      setTimeout(() => {
        setActiveIdx(idx % 12);
        setActiveStep(idx);
        setTimeout(() => {
          setActiveIdx((cur) => (cur === idx % 12 ? null : cur));
          setActiveStep((cur) => (cur === idx ? null : cur));
        }, 1400);
      }, when * 1000);
    },
    [freqFor, getCtx]
  );

  const stopDyad = useCallback(() => {
    const d = dyadNodesRef.current;
    if (d && audioCtxRef.current) {
      const { ctx } = audioCtxRef.current;
      const t = ctx.currentTime;
      d.master.gain.cancelScheduledValues(t);
      d.master.gain.setValueAtTime(Math.max(d.master.gain.value, 0.0001), t);
      d.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      d.oscs.forEach((o) => o.stop(t + 0.45));
      dyadNodesRef.current = null;
    }
    setDyad(null);
  }, []);

  const holdFifth = (kind) => {
    if (dyad === kind) {
      stopDyad();
      return;
    }
    stopDyad();
    const { ctx, destination } = getCtx();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
    master.connect(destination);
    const oscs = [];
    // Exact integer harmonics, so the beat between 3×C and 2×G is physically
    // real rather than an effect: it emerges from the tuning itself.
    const freqs = [C4_FREQ, kind === "pure" ? C4_FREQ * 1.5 : G4_ET];
    const harmonicGains = [0.3, 0.1, 0.05];
    freqs.forEach((f) => {
      harmonicGains.forEach((gain, h) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f * (h + 1);
        g.gain.value = gain;
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        oscs.push(osc);
      });
    });
    dyadNodesRef.current = { master, oscs };
    setDyad(kind);
  };

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const hourIdx = NOTES.findIndex((n) => n.hour === hour12);

  useEffect(() => {
    if (lastHourRef.current === null) {
      lastHourRef.current = hours;
      return;
    }
    if (hours !== lastHourRef.current) {
      lastHourRef.current = hours;
      if (soundOn) strike(hourIdx);
    }
  }, [hours, soundOn, hourIdx, strike]);

  // Tours. "Circle": 12 octave-folded 12-TET pitch classes; the thread closes.
  // "Spiral": 13 strikes walk twelve literal pure 3:2 fifths up from C2; the
  // final strike lands near C but comma-sharp, and the thread misses its start.
  const runTour = (mode) => {
    if (touring) return;
    stopDyad();
    setTouring(true);
    setLastTour(mode);
    getCtx();
    const steps = mode === "spiral" ? 13 : 12;
    for (let i = 0; i < steps; i++) strike(i, i * 0.55, 1.6, mode);
    setTimeout(() => setTouring(false), steps * 550 + 800);
    // The thread overlay animates off the tour clock; this timeout only
    // removes it once it has fully faded.
    setTourAnim({ mode, startedAt: Date.now() });
    setTimeout(() => setTourAnim(null), 12 * 550 + 600 + 1400 + 200);
  };

  const C = 200;
  const smooth = !reducedMotion.current;
  const secAngle = (seconds / 60) * 360; // only used under reduced motion
  const minAngle = ((minutes + seconds / 60) / 60) * 360;
  const hrAngle = (((hours % 12) + minutes / 60) / 12) * 360;

  const polar = (angleDeg, r) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };

  // Static geometry: the tick ring never moves, so build it once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const clockTicks = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const [x1, y1] = polar(i * 6, major ? 168 : 174);
        const [x2, y2] = polar(i * 6, 180);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={major ? INK : DIM}
            strokeWidth={major ? 1.4 : 0.6}
            opacity={major ? 0.9 : 0.45}
          />
        );
      }),
    []
  );

  const currentNote = NOTES[hourIdx];
  const pad = (n) => String(n).padStart(2, "0");

  const captionKey = dyad ? dyad : tourAnim ? tourAnim.mode : lastTour ? lastTour : "idle";
  const captionText =
    captionKey === "circle" || captionKey === "spiral" || captionKey === "pure" || captionKey === "tempered"
      ? CAPTIONS[captionKey]
      : CAPTIONS.idle;

  return (
    <div className="page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=IBM+Plex+Mono:wght@300;400;500&display=swap');

        .page {
          min-height: 100vh;
          background: radial-gradient(ellipse 70% 55% at 50% 34%, oklch(0.196 0.004 286.2) 0%, ${BG} 68%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px 36px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          color: ${INK};
        }
        .note-label { font-family: 'Cormorant Garamond', Georgia, serif; }

        .ring-pulse { animation: ringPulse 1.4s ease-out; transform-origin: center; }
        @keyframes ringPulse { 0% { opacity: 0.9; } 100% { opacity: 0; } }

        .struck {
          animation: strikePop 1.2s cubic-bezier(0.22, 0.8, 0.3, 1);
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes strikePop { 0% { transform: scale(1); } 10% { transform: scale(1.09); } 100% { transform: scale(1); } }

        /* Animated OKLCH, used only where the motion carries meaning: */

        /* 1. The tempered fifth beats at ${BEAT_HZ.toFixed(3)} Hz — the glow's
              L and C oscillate at exactly that computed period. The pure
              fifth holds still: locked sound, locked light. */
        .dyad-pure { fill: oklch(0.85 0.152 90); }
        .dyad-tempered { animation: beatGlow ${BEAT_PERIOD_S.toFixed(3)}s ease-in-out infinite; }
        @keyframes beatGlow {
          0%, 100% { fill: oklch(0.62 0.1 89.7); }
          50% { fill: oklch(0.88 0.16 90); }
        }

        /* 2. The hour marker breathes slowly — L rises and settles. */
        .hour-dot { animation: breathe 4s ease-in-out infinite; }
        @keyframes breathe {
          0%, 100% { fill: oklch(0.6 0.11 89.7); }
          50% { fill: oklch(0.8 0.15 90); }
        }

        .sec-sweep {
          transform-box: view-box;
          transform-origin: 50% 50%;
          animation: sweep 60s linear infinite;
        }
        @keyframes sweep { to { transform: rotate(360deg); } }

        @media (prefers-reduced-motion: reduce) {
          .ring-pulse, .struck, .dyad-tempered, .hour-dot, .sec-sweep { animation: none; }
          .ring-pulse { opacity: 0; }
          .dyad-tempered { fill: oklch(0.85 0.152 90); }
        }

        .btn {
          background: transparent;
          color: ${INK};
          border: 1px solid ${BTN_BORDER};
          border-radius: 999px;
          padding: 9px 18px;
          font-family: inherit;
          font-size: 11px;
          letter-spacing: 0.14em;
          cursor: pointer;
          transition: border-color 0.3s ease, color 0.3s ease, background 0.3s ease, opacity 0.3s ease;
        }
        .btn:hover:not(:disabled):not(.active) {
          border-color: oklch(0.728 0.138 89.7 / 0.55);
          color: oklch(0.97 0.005 89);
        }
        .btn.active { background: ${BRASS}; color: ${BG}; border-color: ${BRASS}; }
        .btn:disabled { opacity: 0.45; cursor: default; }
        .btn:focus-visible { outline: 1px solid ${BRASS}; outline-offset: 3px; }

        .note-hit { cursor: pointer; outline: none; }
        .note-hit:focus-visible .hit { stroke: oklch(0.728 0.138 89.7 / 0.55); }

        .caption { animation: captionIn 0.6s ease; }
        @keyframes captionIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <header style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.38em", color: INK, textTransform: "uppercase" }}>
          Horologium Quintarum
        </div>
        <div style={{ marginTop: 6, fontSize: 9, letterSpacing: "0.24em", color: DIM, textTransform: "uppercase" }}>
          A study in musical temperament
        </div>
      </header>

      <svg
        viewBox="0 0 400 400"
        style={{ width: "min(88vw, 420px)", height: "auto", display: "block" }}
        role="img"
        aria-label={`Circle of fifths clock showing ${pad(hours)}:${pad(minutes)}. The hour note is ${currentNote.label}.`}
      >
        <circle cx={C} cy={C} r={192} fill="none" stroke={FAINT} strokeWidth="1" />
        <circle cx={C} cy={C} r={186} fill="none" stroke={DIM} strokeWidth="0.5" opacity="0.5" />

        <circle
          cx={C}
          cy={C}
          r={192}
          fill="none"
          stroke={BRASS}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={`${((minutes * 60 + seconds) / 3600) * 2 * Math.PI * 192} ${2 * Math.PI * 192}`}
          transform={`rotate(-90 ${C} ${C})`}
          opacity="0.55"
        />

        {clockTicks}

        {NOTES.map((n, i) => {
          const [x, y] = polar(i * 30, 143);
          const [rx, ry] = polar(i * 30, 110);
          const isHour = i === hourIdx;
          const isRinging = i === activeIdx;
          // C and G carry the sustained fifth; they glow while it plays.
          const dyadClass =
            dyad && (i === 0 || i === 1) ? (dyad === "pure" ? "dyad-pure" : "dyad-tempered") : "";
          return (
            <g
              key={n.label}
              className="note-hit"
              role="button"
              tabIndex={0}
              aria-label={`play ${n.label}`}
              onClick={() => strike(i, 0, 1.8)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  strike(i, 0, 1.8);
                }
              }}
            >
              {isRinging && (
                <circle className="ring-pulse" cx={x} cy={y} r={26} fill="none" stroke={BRASS} strokeWidth="1" />
              )}
              <circle className="hit" cx={x} cy={y} r={22} fill="transparent" stroke="none" strokeWidth="1" />
              <text
                className={`note-label ${isRinging ? "struck" : ""} ${dyadClass}`}
                x={x}
                y={y + (n.sub ? -2 : 1)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={n.sub ? 21 : 27}
                fontWeight={600}
                fill={isRinging ? BRASS : isHour ? INK : DIM}
                style={{ transition: "fill 0.6s ease" }}
              >
                {n.label}
              </text>
              {n.sub && (
                <text
                  className="note-label"
                  x={x}
                  y={y + 15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14}
                  fill={isRinging ? BRASS : isHour ? INK : DIM}
                  opacity="0.8"
                  style={{ transition: "fill 0.6s ease" }}
                >
                  {n.sub}
                </text>
              )}
              {/* Relative minor — the circle of fifths' everyday reference use. */}
              <text
                className="note-label"
                x={rx}
                y={ry}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontStyle="italic"
                fill={DIM}
                opacity={isHour ? 0.95 : 0.6}
                pointerEvents="none"
                aria-hidden="true"
              >
                {n.rel}
              </text>
              {isHour && (
                <circle className="hour-dot" cx={x} cy={y + (n.sub ? 27 : 21)} r={1.8} fill={BRASS} />
              )}
            </g>
          );
        })}

        {/* Tour thread: while a tour plays, a thread traces one lap in step with
            the strikes, then fades. On the circle tour it closes perfectly. On
            the spiral tour the radius grows by the accumulated sharpness of
            pure fifths over 12-TET (1.6 px per cent), so the thread misses its
            start by the Pythagorean comma — the gap made visible, to scale. */}
        {tourAnim && (() => {
          // Clamp below at 0: the tour clock starts on the first rAF after launch.
          const clock = reducedMotion.current ? now.getTime() : tourNow;
          const elapsed = Math.max(0, clock - tourAnim.startedAt);
          const spiral = tourAnim.mode === "spiral";
          const p = Math.min(elapsed / 550, 12);
          const rOf = (k) => 58 + (spiral ? k * ET_FIFTH_FLATTENING_CENTS * 1.6 : 0);
          const pts = [];
          for (let k = 0; k < p; k += 0.1) pts.push(polar(k * 30, rOf(k)));
          pts.push(polar(p * 30, rOf(p)));
          const fadeStart = 12 * 550 + 600;
          const opacity = elapsed < fadeStart ? 1 : Math.max(0, 1 - (elapsed - fadeStart) / 1400);
          const closed = p >= 12;
          const [tipX, tipY] = polar(p * 30, rOf(p));
          const [c0x, c0y] = polar(0, rOf(0));
          const [c12x, c12y] = polar(0, rOf(12));
          return (
            <g opacity={opacity} pointerEvents="none">
              <polyline
                points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
                fill="none"
                stroke={BRASS}
                strokeWidth="1"
                opacity="0.7"
              />
              {Array.from({ length: Math.floor(p) + 1 }, (_, k) => {
                const [dx, dy] = polar(k * 30, rOf(k));
                return <circle key={k} cx={dx} cy={dy} r={k === 0 ? 2.6 : 1.8} fill={BRASS} />;
              })}
              {!closed && <circle cx={tipX} cy={tipY} r={3.2} fill="none" stroke={BRASS} strokeWidth="1" />}
              {closed && spiral && (
                <g>
                  <line x1={c0x} y1={c0y} x2={c12x} y2={c12y} stroke={INK} strokeWidth="0.8" opacity="0.9" />
                  <text x={c0x + 7} y={(c0y + c12y) / 2 + 3} fontSize="9" fill={BRASS} letterSpacing="0.08em">
                    +{PYTHAGOREAN_COMMA_CENTS.toFixed(1)}¢
                  </text>
                </g>
              )}
              {closed && !spiral && (
                <circle className="ring-pulse" cx={c0x} cy={c0y} r={10} fill="none" stroke={BRASS} strokeWidth="1" />
              )}
            </g>
          );
        })()}

        {(() => {
          const [hx, hy] = polar(hrAngle, 88);
          const [mx, my] = polar(minAngle, 124);
          return (
            <g>
              <line x1={C} y1={C} x2={hx} y2={hy} stroke={INK} strokeWidth="4.5" strokeLinecap="round" />
              <line x1={C} y1={C} x2={mx} y2={my} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
              {smooth ? (
                <g className="sec-sweep" style={{ animationDelay: `-${secOffsetRef.current.toFixed(3)}s` }}>
                  <line x1={C} y1={C + 24} x2={C} y2={C - 150} stroke={BRASS} strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />
                </g>
              ) : (
                (() => {
                  const [sx, sy] = polar(secAngle, 150);
                  const [st, sty] = polar(secAngle + 180, 24);
                  return <line x1={st} y1={sty} x2={sx} y2={sy} stroke={BRASS} strokeWidth="0.9" strokeLinecap="round" opacity="0.85" />;
                })()
              )}
              <circle cx={C} cy={C} r={4.5} fill={BG} stroke={BRASS} strokeWidth="1.2" />
            </g>
          );
        })()}
      </svg>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 300, letterSpacing: "0.08em" }}>
          {pad(hours)}:{pad(minutes)}
          <span style={{ color: DIM, fontSize: 18 }}>:{pad(seconds)}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: DIM, letterSpacing: "0.12em" }}>
          THE HOUR IS{" "}
          <span className="note-label" style={{ color: BRASS, fontSize: 17, letterSpacing: 0 }}>
            {currentNote.label}
            {currentNote.sub ? ` / ${currentNote.sub}` : ""}
          </span>
          {" — "}
          {currentNote.sig} · rel.{" "}
          <span className="note-label" style={{ fontSize: 15, fontStyle: "italic", letterSpacing: 0 }}>
            {currentNote.rel}
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: BRASS, letterSpacing: "0.16em", minHeight: 16 }}>
          {tourAnim?.mode === "spiral" && activeStep !== null && (
            <>
              CHAIN STEP {activeStep} · {FIFTH_CHAIN_LABELS[activeStep]}
              {activeStep === 12 ? ` · +${PYTHAGOREAN_COMMA_CENTS.toFixed(2)}¢` : ""}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn" onClick={() => runTour("circle")} disabled={touring}>
          {touring && lastTour === "circle" ? "touring…" : "tour the circle"}
        </button>
        <button className="btn" onClick={() => runTour("spiral")} disabled={touring}>
          {touring && lastTour === "spiral" ? "climbing…" : "climb the spiral"}
        </button>
        <button
          className={`btn ${soundOn ? "active" : ""}`}
          onClick={() => {
            getCtx();
            setSoundOn((s) => !s);
          }}
        >
          {soundOn ? "chime · on" : "chime · off"}
        </button>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 9, letterSpacing: "0.24em", color: DIM, textTransform: "uppercase" }}>
          Hold a fifth
        </span>
        <button className={`btn ${dyad === "pure" ? "active" : ""}`} onClick={() => holdFifth("pure")} disabled={touring}>
          pure · 3:2
        </button>
        <button className={`btn ${dyad === "tempered" ? "active" : ""}`} onClick={() => holdFifth("tempered")} disabled={touring}>
          tempered · 12-tet
        </button>
      </div>

      <div
        key={captionKey}
        className="caption"
        style={{
          marginTop: 22,
          fontSize: 10,
          color: DIM,
          letterSpacing: "0.14em",
          textAlign: "center",
          maxWidth: 400,
          lineHeight: 1.8,
          minHeight: 54,
          textTransform: "uppercase",
        }}
      >
        {captionText}
      </div>

      <footer style={{ marginTop: 10, fontSize: 9, letterSpacing: "0.3em", color: FAINT }}>
        · MMXXVI ·
      </footer>
    </div>
  );
}
