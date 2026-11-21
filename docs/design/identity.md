# TRACEFLOW — Identity, Voice, Logo, Iconography (M1-D1)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §9.1 · Tokens: `design-tokens.md`

## 1. Positioning line
*Every request has a story. See the whole picture.* (from `PRD.md`). Used as hero eyebrow/H1 support; not repeated as slogan elsewhere.

## 2. Art direction
**White-first, editorial, engineered calm.** Precise, modern, refined, confident. Distinct from generic admin templates by (a) typographic hierarchy (serif display + grotesque body), (b) the signal-path motif, (c) strict token discipline, (d) honest labelling as a visible design element.

- Light mode only for V1. Dark mode not required; no dark-mode tokens are defined (avoids unverified contrast pairs).
- Colour is 90% paper/ink/hairline; signal blue ≈ 8%; violet ≤ 2% (secondary highlight: selected chart series, "focus" annotation, public-site accents). Semantic colours appear only for state.
- Elevation is rare: borders first, shadow only for floating layers (see tokens).

## 3. Motif: signal path
Orthogonal line segments with 45° elbows, a junction dot where paths fork, a short pulse (tick) marking time. Used in: wordmark mark, hero line-draw, section dividers (single static hairline with one junction dot), empty-state illustrations, 404.
Rules: stroke 1.5–2 px at 1×, round caps, no gradients, no glow, max two colours (ink + signal). Illustrations are original vector; synthetic hero trace is generated from the repository fixture (`docs/testing/fixtures.md`) so the picture is truthful.

## 4. Logo and favicon
- **Name rendering:** wordmark "traceflow" in lowercase; product name in prose is "TRACEFLOW" (small caps allowed in nav). 
- **Mark (spec, to be drawn as original SVG at M5):** a 24×24 grid; one horizontal baseline path entering from the left at y=12, forking at x=12 into an upper branch (y=6) and lower branch (y=18) with 45° elbows; the upper branch ends in a 3 px junction dot in signal blue, lower branch ends open. Stroke ink `#151A25`, 2 px. Reads as "request splitting across services".
- **Wordmark:** Instrument Serif lowercase, tracking −1%, baseline-aligned with the mark; mark-to-text gap = 8 px (1 grid unit).
- **Clear space:** ≥ height of the junction dot ×4 (≈ mark height/3) on all sides. **Minimum size:** mark 16 px; lockup 96 px wide.
- **Favicon:** mark only, ink on transparent (SVG, `prefers-color-scheme` agnostic because browser tab is light/dark independent: use ink `#151A25` with 1 px white outer stroke so it stays visible on dark tab strips). Plus 180×180 apple-touch with paper background and 24 px padding. Provenance: original, authored in-repo; status **NOT YET AUTHORED**.
- **Misuse:** no recolouring outside ink/signal, no effects, no rotation, no placing on photographic backgrounds.
- Contrast: ink mark on paper 17.41:1; signal dot on paper 5.17:1 (see tokens).

## 5. Voice
Plain, exact, calm, second person for instructions, never hype.
| Do | Don't |
| --- | --- |
| "Parent span not received." | "Orphan span detected!" / "No parent call." |
| "p99 not shown: 12 samples (needs 100)." | "p99 unavailable" / showing 0 |
| "Observed SERVER spans only; sampling is not reconstructed." | "Accurate latency" |
| Error text states what happened + next step + retry | "Something went wrong" |
Numbers: tabular figures, unit always adjacent (ms, µs, %), thousands separated by thin space or comma per locale, durations auto-scale (µs/ms/s) with the raw ns available in a tooltip/inspector. Timestamps: ISO-like `2026-11-22 14:03:07.123 UTC` with explicit zone toggle (UTC ↔ local); never ambiguous.

## 6. Iconography
Own minimal set (≈24 glyphs) drawn on the 24 grid, 1.5 px stroke, same motif rules; **or** Lucide (ISC licence) if adopted by ADR at M2. Decision pending; until then `asset-inventory.md` lists Lucide as *candidate, not adopted*. Icons never carry meaning alone: status uses icon + text (§10). Status glyphs: ✓ circle (OK), ✕ circle (error), ! triangle (warning), clock (incomplete/late), dashed ring (unset/unknown).

## 7. Imagery rules
No photography. No stock. Only original vector illustration and live data visualisations. Hero trace illustration has a text alternative describing the synthetic journey.
