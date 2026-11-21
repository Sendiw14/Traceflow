# TRACEFLOW — Creative Benchmark (M1-D4)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet (design) · **Spec:** §9.2
**Method and limit:** Written from the author's prior knowledge of the named products and design traditions. No site was visited, scraped or screenshotted in this session, and no image or code was copied. Statements about specific products describe general, widely known qualities; verify against live products before citing them externally. Status of any "observed" claim: **NOT TESTED**.

This is a study of *qualities*, not a template. Nothing here permits reproducing a layout, hero, animation, illustration or brand of any reference.

## 1. Editorial / interactive references (public site)

| Reference tradition | Quality worth learning | How TRACEFLOW applies it | Rejected |
| --- | --- | --- | --- |
| Print-editorial web (long-form journalism, type-led product pages) | Large serif/sans contrast, strong measure (60–72ch), confident whitespace, numbered sections | Display serif for hero/section heads, 12-col grid with deliberate empty columns, numbered "journey" steps | Magazine-style decorative drop caps, pull-quotes with no real content |
| Swiss/International typographic style | Hierarchy by size and weight alone; rules (1px lines) as structure | Hairline dividers, left-aligned ragged-right text, one accent colour | Pure minimalism that hides content behind icons |
| Scroll-narrative award sites (Awwwards/FWA-type storytelling) | Pacing: one idea per viewport, state change tied to content, restraint between moments | Single hero line-draw; one scrubbed journey section tied to a real fixture trace | Scroll-jacking, parallax, full-viewport video, WebGL for its own sake, loaders that gate content |
| Technical-diagram illustration (timing diagrams, transit maps, circuit schematics) | Orthogonal paths, junction dots, consistent stroke weight, labels on the line | Identity built from signal path + junction + pulse (see `identity.md`); hero line draws a *real* synthetic trace | Neon glow, gradient mesh blobs, "network of floating nodes" stock art |
| Developer-docs craft (clear sidebars, copy buttons, code with real output) | Scannability, tested snippets, quiet chrome | `/docs/*` layout, copy buttons with live-region confirmation | Marketing copy inside docs |

## 2. Observability products (dashboard)

| Reference | Quality worth learning | Applied | Rejected |
| --- | --- | --- | --- |
| Jaeger-style trace view | Waterfall + tree as the core investigative object; spans selectable; time axis you can trust | Waterfall with fixed axis while reading (§9.3), tree alternative, span inspector | Dated density without hierarchy; tiny hit targets; colour-only error marks |
| Grafana-style dashboards | Semantic density, shared time range, panels that state unit/range | Global time range in URL, every panel carries unit/window/population line (§10) | Panel sprawl, user-built dashboards (out of scope), dark-first theming (not V1) |
| Trace-timeline "service map" views | Evidence-linked graph; selection opens supporting traces | Observed-only graph + mandatory sortable edge table; edge click → sample traces | Auto-layout animation that never settles; inferred edges; large decorative glow |
| Error-tracking products | Grouping and "what changed" framing | Error rows deep-link to failing span with parent/child context | AI "root cause" claims (out of scope, NFR-01) |

## 3. Qualities TRACEFLOW is built around

1. **Engineered calm:** white paper, one signal blue, ink text, hairlines. Colour means state or data; never decoration.
2. **Truth in labels:** every figure shows unit, window, population and what is missing (§10). This *is* a design feature, not footnote text.
3. **Time as the axis of the brand:** trace-line motif, tabular numerals, monospace IDs.
4. **Two registers:** expressive editorial public site; dense, quiet diagnostic app. They share tokens, not layout.
5. **Reduced-motion is a first-class design:** every animated moment has a static, equally informative composition.

## 4. Originality constraints (checklist for every design review)

- [ ] No reference's identifiable hero composition, illustration, wordmark, colour pairing or animation sequence is reproduced.
- [ ] No stock illustration, stock 3D, AI-generated imagery, or third-party icon set beyond those in `asset-inventory.md`.
- [ ] Hero illustration is original vector, derived from the repository's synthetic fixture trace.
- [ ] No claim, metric, customer logo, testimonial or "trusted by" content that is not factual.
- [ ] A reviewer who has seen the references can say what TRACEFLOW *looks like* without naming one of them.

## 5. Expected product benefits and how they are verified

| Benefit | Verification (all **NOT TESTED** until M5–M7) |
| --- | --- |
| Faster first-time comprehension of trace anatomy | Usability task: "find the slow span" without hints (§10) |
| Fewer misreads of sampled/partial data | Task: identify missing-parent trace as incomplete |
| Distinct identity | Reviewer checklist §4 |
| Low motion cost | Performance budgets in `motion-spec.md`; Lighthouse lab proxy |

No score or "x times better" claim will be made.
