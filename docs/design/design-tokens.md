# TRACEFLOW — Design Tokens (M1-D1)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §9.1, §9.4
**Contrast method:** WCAG 2.x relative-luminance ratio, computed by [`tools/contrast.py`](tools/contrast.py) (stdlib Python, reproducible: `python3 docs/design/tools/contrast.py`). Tables below are that script's actual output (run 2026-11-22). Thresholds: text ≥ 4.5:1, UI/graphics ≥ 3:1 (WCAG 1.4.3 / 1.4.11). Status: ratios **PASS** as computed; rendered-pixel verification in a browser is **NOT TESTED**.

Light mode only (dark mode not a V1 requirement). Tokens are CSS custom properties prefixed `--tf-`. No component may use a raw hex.

## 1. Colour tokens

| Token | Hex | Role |
| --- | --- | --- |
| `--tf-paper` | `#FFFFFF` | Primary surface (cards, tables, inputs, panels) |
| `--tf-canvas` | `#F7F9FC` | Page background, app shell |
| `--tf-sunken` | `#EEF1F6` | Wells, code blocks, zebra/hover rows, waterfall track |
| `--tf-ink` | `#151A25` | Primary text, mark, primary-button fill |
| `--tf-ink-2` | `#3A4356` | Secondary text |
| `--tf-ink-3` | `#5B6578` | Tertiary text, captions, placeholders (≥ 4.5 on all surfaces) |
| `--tf-ink-disabled` | `#9AA3B5` | Disabled text only (WCAG-exempt; also never the only cue) |
| `--tf-signal` | `#2563EB` | Brand/primary accent, data series 1, primary-button alt fill |
| `--tf-signal-strong` | `#1D4ED8` | Links, focus ring, text accent on tinted surfaces |
| `--tf-signal-tint` | `#EAF1FF` | Selected row/span, info background |
| `--tf-violet` | `#7C3AED` | Secondary highlight (≤ 2% of area), series 2 |
| `--tf-violet-strong` | `#6D28D9` | Violet text/fill with white text |
| `--tf-violet-tint` | `#F3EDFF` | Violet-highlight background |
| `--tf-success` / `-fill` / `-tint` | `#0F7B4A` / `#15803D` / `#E6F5EC` | Success text / icon & bar / background |
| `--tf-warning-text` / `-fill` / `-tint` | `#8A5300` / `#B45309` / `#FFF4E0` | Warning, partial, clock-skew |
| `--tf-error` / `-fill` / `-tint` | `#C0262D` / `#C0262D` / `#FDECEC` | Error text, error span bar/icon, background |
| `--tf-border` | `#D5DAE3` | Decorative hairline dividers (1px). **Never the sole boundary of an interactive control** |
| `--tf-control-border` | `#7D879B` | Input/select/checkbox/button-outline border (≥ 3:1 on paper, canvas, sunken) |
| `--tf-grid` | `#E3E7EE` | Chart gridlines (decorative; values also labelled on axes) |
| `--tf-focus` | `#1D4ED8` | 2px focus ring, 2px offset, plus 1px paper inner gap |

Design changes vs spec §9.1 candidates: `#2563EB`, `#7C3AED`, `#151A25`, `#FFFFFF`, `#F7F9FC` retained exactly. Added: ink scale, strong variants, tints, semantic colours, borders. The spec's signal blue passes as text on paper (5.17) and canvas (4.90) but only barely on tints (≥ 4.52) — hence `signal-strong` for text on tints and for links.

### 1.1 Text on surfaces (target ≥ 4.5) — computed
| token | hex | paper | canvas | sunken | signal-tint | success-tint | warning-tint | error-tint | violet-tint |
|---|---|---|---|---|---|---|---|---|---|
| ink | #151A25 | 17.41 | 16.50 | 15.38 | 15.36 | 15.45 | 15.97 | 15.24 | 15.23 |
| ink-2 | #3A4356 | 9.92 | 9.40 | 8.76 | 8.75 | 8.80 | 9.10 | 8.68 | 8.68 |
| ink-3 | #5B6578 | 5.87 | 5.57 | 5.18 | 5.18 | 5.21 | 5.39 | 5.14 | 5.13 |
| signal-strong | #1D4ED8 | 6.70 | 6.35 | 5.92 | 5.91 | 5.95 | 6.15 | 5.87 | 5.86 |
| signal | #2563EB | 5.17 | 4.90 | 4.57 | 4.56 | 4.59 | 4.74 | 4.53 | 4.52 |
| violet | #7C3AED | 5.70 | 5.40 | 5.03 | 5.03 | 5.06 | 5.23 | 4.99 | 4.98 |
| violet-strong | #6D28D9 | 7.10 | 6.74 | 6.28 | 6.27 | 6.31 | 6.52 | 6.22 | 6.21 |
| success | #0F7B4A | 5.31 | 5.04 | 4.69 | 4.69 | 4.72 | 4.88 | 4.65 | 4.65 |
| warning-text | #8A5300 | 6.33 | 6.00 | 5.59 | 5.58 | 5.62 | 5.81 | 5.54 | 5.54 |
| error | #C0262D | 5.90 | 5.60 | 5.22 | 5.21 | 5.24 | 5.42 | 5.17 | 5.16 |


**Findings (computed, not guessed):**
- Every text token in the table passes 4.5:1 on every listed surface. Lowest: `signal` on `violet-tint` 4.52 and `violet` on `violet-tint` 4.98 → rule: *use `signal-strong`/`violet-strong` for text on tinted backgrounds; `signal`/`violet` text only on paper/canvas.*
- A prior candidate `ink-4 #6B7487` was **dropped**: 4.45:1 on canvas fails. Placeholders use `ink-3`.
- `warning` as text uses `#8A5300` (6.33 on paper); the brighter amber is fill-only.

### 1.2 Non-text UI (target ≥ 3.0) — computed
| token | hex | paper | canvas | sunken |
|---|---|---|---|---|
| control-border | #7D879B | 3.61 | 3.43 | 3.19 |
| focus-ring | #1D4ED8 | 6.70 | 6.35 | 5.92 |
| signal | #2563EB | 5.17 | 4.90 | 4.57 |
| success-fill | #15803D | 5.02 | 4.76 | 4.43 |
| warning-fill | #B45309 | 5.02 | 4.76 | 4.44 |
| error-fill | #C0262D | 5.90 | 5.60 | 5.22 |
| violet | #7C3AED | 5.70 | 5.40 | 5.03 |
| chart-teal | #0E7490 | 5.36 | 5.08 | 4.73 |
| chart-magenta | #BE185D | 6.04 | 5.72 | 5.33 |
| chart-slate | #475569 | 7.58 | 7.18 | 6.69 |
| chart-sky | #0369A1 | 5.93 | 5.63 | 5.24 |


- `--tf-border` (1.40) and `--tf-grid` (1.24) are **intentionally below 3:1**: decorative separators only. Any control whose boundary conveys "this is a control" uses `--tf-control-border` (≥ 3.19 on every surface).
- Focus ring `#1D4ED8` ≥ 5.92 on all surfaces (WCAG 2.4.11/2.4.13: ≥ 3:1 and ≥ 2px).

### 1.3 Text on filled controls — computed
| pairing | ratio |
| --- | --- |
| white on signal | 5.17 |
| white on signal-strong | 6.70 |
| white on ink | 17.41 |
| white on violet-strong | 7.10 |
| white on success | 5.31 |
| white on warning-text | 6.33 |
| white on error | 5.90 |

Primary button = `ink` fill + white text (17.41). Accent button = `signal` fill + white (5.17); hover `signal-strong` (6.70). Destructive = `error` fill + white (5.90).

### 1.4 Intentionally below threshold
| pairing | ratio |
| --- | --- |
| ink-disabled (#9AA3B5) on paper | 2.54 |
| border hairline (#D5DAE3) on paper | 1.40 |
| grid line (#E3E7EE) on paper | 1.24 |

## 2. Semantic state mapping (colour is never the only cue)

| State | Colour | Icon | Required text | Where |
| --- | --- | --- | --- | --- |
| OK / success | success | check-circle | "OK" | status badge, span status |
| Error | error | x-circle | "Error" | span bar edge + badge, error counts |
| Unset (OTel status unset) | ink-3 | dashed ring | "Unset" | span status |
| Warning / partial / incomplete | warning | triangle-! | "Partial", "Parent not received" | trace notices |
| Clock skew | warning | clock-! | "Clock skew" | trace/span notice |
| Estimate | ink-3 | tilde "≈" prefix | "estimate" | duration with `observed_range_estimate` |
| Insufficient samples | ink-3 | — | "needs 100 samples (n=12)" | p99 etc |
| Information | signal | info-circle | — | banners |
| Synthetic/demo | violet | beaker | "Synthetic data — read only" | `/demo` banner |

Error spans additionally use a **pattern**: 2px error-coloured left border + solid fill; selected span uses outline not colour change alone.

## 3. Chart palette

Categorical series (≥ 3:1 on paper, computed above; adjacent-series distinguishability relies on **direct labels + marker shape + dash style**, not hue alone):

| # | Name | Hex | On paper | Marker / dash |
| --- | --- | --- | --- | --- |
| 1 | signal | `#2563EB` | 5.17 | ● solid |
| 2 | violet | `#7C3AED` | 5.70 | ■ dashed 6 3 |
| 3 | teal | `#0E7490` | 5.36 | ▲ dotted 2 3 |
| 4 | amber | `#B45309` | 5.02 | ◆ dash-dot |
| 5 | magenta | `#BE185D` | 6.04 | ✚ long dash |
| 6 | green | `#15803D` | 5.02 | ▼ solid thin |
| 7 | slate | `#475569` | 7.58 | ○ solid |
| 8 | sky | `#0369A1` | 5.93 | ◇ dashed 2 2 |

Rules: ≤ 8 series; beyond 8 → "Other" in `slate`. Error always `--tf-error` (never from the categorical set) paired with ✕ marker. Service colour assignment is stable by hash of `service_name` modulo palette and **never used to encode status**. Colour-vision-deficiency simulation of this palette: **NOT TESTED** (to run at M5; mitigation is redundant encoding above).

Sequential ramp (counts, heat, edge volume), light → dark: `#DBE7FF` (1.24) `#9DBBF7` (1.93) `#5E8DEF` (3.21) `#2563EB` (5.17) `#1E40AF` (8.72) `#172554` (14.69). Cell values are printed as text; ramp steps below 3:1 never used for a boundary that carries meaning (each cell has a 1px `control-border` outline or a text value).

Latency percentiles: p50 = ink-2 line, p95 = signal, p99 = violet. Gaps (null) = no line segment, no marker, hatched band label "no data".

## 4. Spacing (4/8 px system)
`--tf-space-0:0 · 1:4px · 2:8px · 3:12px · 4:16px · 5:20px · 6:24px · 8:32px · 10:40px · 12:48px · 16:64px · 20:80px · 24:96px · 32:128px`.
Rules: component padding on 4px steps; layout gaps and section rhythm on 8px multiples; public-site section padding 96/128 px (≥1024), 64 px (<768). Touch/click target min **24×24 CSS px** (WCAG 2.5.8) with ≥ 8 px spacing; primary controls 40 px high (44 on touch viewports ≤ 768).

## 5. Radius
`--tf-radius-0:0 · sm:4px (chips, badges, inputs) · md:8px (cards, buttons, panels) · lg:12px (dialogs, drawers) · full:999px (pills, dots)`. Waterfall bars radius 2px. Tables and the shell are square-edged for editorial precision.

## 6. Borders
1px solid `--tf-border` for dividers/cards; 1px `--tf-control-border` for controls; 2px focus ring; 2px left accent on error rows/spans. No double borders; no borders + shadow combined on the same surface except floating layers.

## 7. Elevation
| Level | Use | Style |
| --- | --- | --- |
| 0 | Page, panels, cards, tables | none (border only) |
| 1 | Sticky header/filter bar on scroll | `0 1px 0 var(--tf-border)` (hairline, not blur) |
| 2 | Popover, menu, tooltip | `0 4px 16px rgb(21 26 37 / 0.10), 0 0 0 1px var(--tf-border)` |
| 3 | Dialog, drawer | `0 12px 40px rgb(21 26 37 / 0.14), 0 0 0 1px var(--tf-border)` + scrim `rgb(21 26 37 / 0.40)` |
Shadows use ink-tinted, never pure black; never used for non-floating content.

## 8. Z-index scale
`base 0 · sticky 10 · drawer 30 · dialog 40 · popover 50 · toast 60`.

## 9. Token → code contract
Single `tokens.css` (custom properties) is the source; TS consumers read via CSS variables, no duplicated constants except chart series order. Changes to colour tokens require re-running `contrast.py` and updating this file in the same PR (reviewer checks).
