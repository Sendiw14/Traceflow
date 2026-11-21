# TRACEFLOW — Typography and Font Licensing (M1-D1)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §9.1 ("licensed/system fonts … never load remote assets")

## 1. Families
| Role | Family | Use | Licence (upstream, to verify at import) | Delivery |
| --- | --- | --- | --- | --- |
| Display (public site only) | **Instrument Serif** (Regular + Italic) | Hero, section heads, wordmark | SIL OFL 1.1 | self-hosted WOFF2, latin subset |
| UI / body | **Inter** (variable, opsz if available) | App UI, docs body, public body | SIL OFL 1.1 | self-hosted variable WOFF2, latin subset, `font-display: swap` |
| Mono / IDs / code | **JetBrains Mono** (variable) | Trace/span IDs, attributes, code | SIL OFL 1.1 | self-hosted variable WOFF2, latin subset |

**Fallback stacks (metric-adjusted with `size-adjust` at M5 to limit CLS):**
- Display: `"Instrument Serif", "Iowan Old Style", "Palatino Linotype", Georgia, serif`
- UI: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- Mono: `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`

## 2. Licensing and hosting rules
- No remote font CDN (Google Fonts, Adobe Fonts, Typekit): third-party requests leak visitor IPs and hurt performance (spec §9.1, §9.4).
- Font binaries are committed only if the OFL permits redistribution (it does for the families above) **and** each file ships with its upstream `OFL.txt` and copyright line in `apps/web/public/fonts/` + an entry in `asset-inventory.md`. Reserved Font Names are respected (no renaming/modified redistribution).
- Source of binaries: upstream release archives (GitHub releases / the foundry's official repo) with SHA-256 recorded at import. **Not yet imported; licence texts NOT YET VERIFIED in this session** (no network fetch performed). Gate: M5 asset import, reviewer confirms licence text matches.
- Fallback if any licence check fails: Display → system serif stack; UI/Mono → system stacks (no layout change except metrics).
- Subsetting (latin + latin-ext punctuation, numerals, `→ ↗ ≈ µ ✓ ✕`) is permitted by OFL; ID/attribute rendering must tolerate characters outside the subset by falling back per-glyph (unusual Unicode content is an API requirement, spec §11).
- Weights shipped: Inter 400/500/600 (variable axis), JetBrains Mono 400/500, Instrument Serif 400. Total target ≤ 150 KB WOFF2 critical (to be measured; **NOT TESTED**).

## 3. Type scale (rem, 16 px root; fluid only on public display sizes)
| Token | Size / line-height | Weight | Family | Use |
| --- | --- | --- | --- | --- |
| `display-xl` | clamp(48px, 7vw, 96px) / 1.0 | 400 | Display | Hero H1 (public) |
| `display-l` | clamp(36px, 5vw, 64px) / 1.05 | 400 | Display | Section H2 (public) |
| `h1` | 32 / 40 | 600 | UI | Page title (app, docs) |
| `h2` | 24 / 32 | 600 | UI | Panel/section |
| `h3` | 18 / 28 | 600 | UI | Card/subsection |
| `body-l` | 18 / 28 | 400 | UI | Public lead text |
| `body` | 16 / 24 | 400 | UI | Default (≥16px on inputs prevents iOS zoom) |
| `body-s` | 14 / 20 | 400 | UI | Tables, dense panels |
| `caption` | 12 / 16 | 500 | UI | Axis labels, badges (min size 12; never < 12px) |
| `overline` | 12 / 16, +6% tracking, uppercase | 600 | UI | Eyebrows, region labels |
| `mono` | 13 / 20 | 400 | Mono | IDs, attributes, code |
| `mono-s` | 12 / 16 | 400 | Mono | Waterfall labels |

Rules: tabular figures (`font-variant-numeric: tabular-nums`) for all numeric columns, axes, durations; `font-feature-settings` limited to `tnum`, `ss01` off. Measure: body 60–72ch, docs 72ch, tables unconstrained. Line-height never < 1.4 for paragraphs (WCAG 1.4.12 text-spacing must not break layouts: tested at 1.5/2/0.12em/0.16em, **NOT TESTED**). Text resizes to 200% without loss (rem units; no fixed-height text containers).

## 4. Display usage guardrails
Instrument Serif never below 28 px, never in the app shell, tables or forms. Italic only for editorial emphasis in one phrase per heading. No letter-spacing > −2% on display.

## 5. Number and identifier formatting
- Trace ID: mono, 32 hex, grouped visually 8·8·8·8 with a thin gap but copy gives the raw string; truncation `1763a0c1…e4f2` + full ID in tooltip/inspector, copy button always copies the full value.
- Durations: `412 µs`, `18.4 ms`, `2.31 s`; always `<unit>`; raw ns via "Details".
- Timestamps use BigInt-backed formatting: ns → `YYYY-MM-DD HH:mm:ss.SSS` (+ optional `.SSSSSS`), zone label visible.
