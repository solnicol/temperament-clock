# Horologium Quintarum

A working clock whose hours are the circle of fifths — and an audible, visible
demonstration of why that circle only closes because we tempered it shut.

**Live: [temperament-clock.vercel.app](https://temperament-clock.vercel.app)**

## The idea

A 12-hour clock face and the circle of fifths share exactly one property: twelve
positions arranged in a circle. This site overlays one on the other — 12 o'clock
is C, 1 o'clock is G, and so on around the dial by fifths. The hour hand always
points at a key; each key shows its signature and relative minor.

That coincidence is the delivery mechanism for something real. Stack twelve
mathematically pure 3:2 fifths and you do **not** return to your starting pitch:

```
(3/2)^12 ÷ 2^7 ≈ 1.01364  →  23.46 cents sharp
```

That gap is the **Pythagorean comma**. Modern equal temperament closes the
circle by flattening every fifth 1.955 cents narrow of pure — each step absorbs
its share of the comma. Every number shown in the app is computed from this
arithmetic at runtime, not quoted.

## What it does

- **Tour the circle** — twelve octave-folded 12-TET pitch classes strike in
  fifths order while a thread traces the lap and closes into a perfect circle.
- **Climb the spiral** — thirteen strikes walk twelve *literal* pure fifths up
  from C2. The thread's radius grows with the accumulated sharpness over equal
  temperament, so the final strike lands at 12 o'clock visibly outside its
  starting point: the comma, drawn to scale and labeled.
- **Hold a fifth** — the audible case for temperament. A sustained pure fifth
  locks (3×C lands exactly on 2×G). The tempered fifth's harmonics miss by
  0.89 Hz, heard as a slow beat — and shown as a glow on C and G whose OKLCH
  lightness oscillates at exactly that computed period.
- **Hear the problem** — a guided first listen moves from pure fifth, to
  tempered beat, to the pure-fifths spiral that misses home. Tap any note to
  hear it; notes are keyboard-accessible (Tab + Enter).

## Notes on the build

- React + Vite, no other runtime dependencies. All sound is synthesized with
  the Web Audio API — sine partials through a shared limiter, with exact
  integer harmonics in the fifth lab so the beat is physically real rather
  than an effect.
- The second hand sweeps via a CSS animation synced once at mount; the render
  clock ticks at 4 Hz and per-frame rendering runs only while a tour thread is
  on screen. Idle CPU is near zero.
- The palette is defined in OKLCH, and animation is reserved for places where
  the motion carries meaning: the beat glow at the beat frequency, and the
  hour marker's slow breathing. `prefers-reduced-motion` disables both and
  falls back to a discrete second hand.
- The spiral visualization maps radius to *deviation from equal temperament*
  (1.6 px per cent), not absolute pitch — an honest log-frequency spiral would
  make the comma an invisible 0.3% of the total rise.

## Running locally

```sh
pnpm install
pnpm dev      # dev server
pnpm build    # type-check + production build
```

---

*Twelve pure fifths ≠ seven octaves. Everything else follows.*
