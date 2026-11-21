# TRACEFLOW — Asset Inventory and Provenance (M1-D3)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §9.1
Rule: every shipped asset has provenance, licence, hash, and an owner. No asset is imported yet; **all rows NOT YET IMPORTED/AUTHORED**. Licence texts below are from the author's knowledge, **NOT VERIFIED against upstream in this session** (no network fetch); verification is a gate at import (M5) with the reviewer.

| ID | Asset | Type | Source / provenance | Licence | Redistribution in repo | Hash/version | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AS-01 | Inter (variable, latin subset) | Font | Upstream rsms/inter release archive (official) | SIL OFL 1.1 | Allowed with `OFL.txt` + copyright; no reserved-name rename | recorded at import | NOT YET IMPORTED |
| AS-02 | JetBrains Mono (variable, latin) | Font | Upstream JetBrains/JetBrainsMono release | SIL OFL 1.1 | as AS-01 | at import | NOT YET IMPORTED |
| AS-03 | Instrument Serif (Regular, Italic, latin) | Font | Upstream Google Fonts repo (Instrument Type) — *source archive, not the CDN* | SIL OFL 1.1 | as AS-01 | at import | NOT YET IMPORTED |
| AS-04 | TRACEFLOW mark + wordmark | SVG logo | Original, authored in-repo (spec in `identity.md` §4) | Project licence (Apache-2.0 for code/docs); brand-use note: name/logo not licensed for impersonation — owner decision pending | n/a (original) | git SHA | NOT YET AUTHORED |
| AS-05 | Favicon set (SVG, 32, 180) | Images | Derived from AS-04 | as AS-04 | n/a | git SHA | NOT YET AUTHORED |
| AS-06 | Hero trace-line illustration | Inline SVG | Original; generated from repository synthetic fixture trace | Apache-2.0 | n/a | fixture version + SHA | NOT YET AUTHORED |
| AS-07 | Signal-path section dividers, empty-state and 404 illustrations | Inline SVG | Original | Apache-2.0 | n/a | git SHA | NOT YET AUTHORED |
| AS-08 | Icon set (≈24 glyphs) | SVG | **Option A:** original on 24-grid. **Option B:** Lucide (ISC, upstream lucide-icons) — copy individual SVGs only with licence notice | A: Apache-2.0; B: ISC (to verify; requires notice file) | A n/a; B allowed with notice | per icon / version | DECISION PENDING (ADR at M2) |
| AS-09 | Open Graph / social image | PNG | Rendered from AS-04/AS-06 | Apache-2.0 | n/a | git SHA | NOT YET AUTHORED |
| AS-10 | Synthetic fixture JSON for hero/journey | JSON | Generated from `examples/demo-system` run (Opus) | Apache-2.0 | n/a | fixture version | BLOCKED on demo system (M3) |
| AS-11 | Code-highlighting theme (build-time) | CSS tokens | Own theme using design tokens (no third-party theme) | Apache-2.0 | n/a | git SHA | NOT YET AUTHORED |

## Not used (explicit)
Stock photography, stock illustration, AI-generated imagery, third-party UI kits, Google Fonts/Adobe Fonts CDN links, Lottie/third-party animation files, trademarked logos (including GitHub's mark beyond the permitted GitHub-sign-in button — follow GitHub's current brand guidelines at M5 and record the licence), reference-site artwork.

## Privacy / performance constraints
No third-party network requests from any route for assets (fonts, icons, images, analytics). Image/SVG budgets: each illustration ≤ 20 KB SVG gz; total public-route critical assets ≤ 150 KB fonts + ≤ 60 KB SVG (targets, **NOT TESTED**).

## Import procedure (M5)
1. Download upstream archive in a clean temp directory; record URL, version, SHA-256. 2. Compare licence text with the one distributed in the archive; copy `OFL.txt`/`LICENSE`. 3. Subset with documented command (recorded in this file). 4. Add row details (hash, date, reviewer). 5. Reviewer (not author) confirms.
