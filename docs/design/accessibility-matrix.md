# TRACEFLOW — Accessibility Matrix (M1-D3)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Target:** WCAG 2.2 Level AA (NFR-04, AC-A11Y-01/02), manual + automated
**Honesty:** Nothing is implemented; every "Verification" is a plan. All results **NOT TESTED**. Automated tools (axe) cover roughly a third of WCAG issues; manual keyboard + screen-reader passes are mandatory evidence. No "accessible" claim is made until those pass. Screen readers to test at M6: VoiceOver+Safari (macOS, iOS), NVDA+Firefox/Chrome (Windows); TalkBack spot-check.

## 1. Cross-cutting criteria → how TRACEFLOW meets them
| WCAG 2.2 SC | Requirement | Design decision | Verification |
| --- | --- | --- | --- |
| 1.1.1 Non-text | Text alt for graphics | Hero/diagrams decorative with adjacent text; charts have table alternative; graph has edge table | axe, manual |
| 1.3.1 / 4.1.2 | Semantics, name/role/value | Native elements first; ARIA only for tree/combobox/tabs per APG | axe + SR |
| 1.3.4 Orientation | No lock | Responsive, landscape tested | manual |
| 1.3.5 | Autocomplete on login/settings fields | none personal; n/a | review |
| 1.4.1 Use of colour | Not sole cue | Icon+text+pattern for status (tokens §2); chart markers/dashes | manual CVD sim |
| 1.4.3 / 1.4.6-ish | Text ≥ 4.5:1 | Computed (tokens §1.1) all PASS | `contrast.py` + axe |
| 1.4.4 / 1.4.10 | 200% resize; 320px reflow | rem units, no fixed heights, inner scroll regions only | manual 200%/400% |
| 1.4.11 | UI/graphics ≥ 3:1 | `control-border`, focus ring, chart colours computed PASS | `contrast.py` |
| 1.4.12 Text spacing | No loss | no fixed-height text | manual bookmarklet |
| 1.4.13 Hover/focus content | Dismissible, hoverable, persistent | tooltips on focus too; `Esc`; never sole carrier | manual |
| 2.1.1/2.1.2 | Keyboard, no trap | per-component maps below | Playwright keyboard-only J-02/J-03/J-04 |
| 2.2.2 Pause | Motion | motion-spec §5 | review |
| 2.3.3 (AAA, adopted) | Motion from interaction | reduced-motion respected | Playwright |
| 2.4.1 Bypass | Skip link | first tab stop | automated |
| 2.4.3 Focus order, 2.4.6 headings/labels, 2.4.7 | Visible focus | ring always visible, not hover-dependent | manual |
| **2.4.11 Focus Not Obscured (AA, 2.2)** | Focused item not hidden by sticky header/inspector sheet | `scroll-padding-top` = header + filter bar height; bottom sheet does not cover focused row (row scrolls into view above sheet) | manual at 360/768 |
| 2.4.13 (AAA) Focus appearance | 2px, ≥ 3:1 | adopted | manual |
| **2.5.7 Dragging Movements (AA, 2.2)** | Alternative to dragging | Map pan/zoom via buttons+keys; waterfall column resize via keyboard/steps; no drag-only | manual |
| **2.5.8 Target Size (AA, 2.2)** | ≥ 24×24 CSS px | tokens §4: controls 40/44px; dense rows ≥ 32px; chips ≥ 24px | automated geometry test |
| **3.2.6 Consistent Help (2.2)** | Help in same place | footer/Docs link in shell consistently | review |
| **3.3.7 Redundant Entry (2.2)** | Don't re-ask | filters retained in URL; settings form retains input on error | Playwright |
| **3.3.8 Accessible Authentication (AA, 2.2)** | No cognitive test | GitHub OAuth redirect only; no CAPTCHA, no password fields | review |
| 3.3.1/3.3.3 | Error identification/suggestion | inline errors linked by `aria-describedby`, `role=alert` only on submit | Playwright + SR |
| 4.1.3 Status messages | Programmatic announcements without focus | polite live region; announce **transitions** (loaded, N more traces, copied, connected), never each poll tick | SR |

## 2. Per-component matrix
| Component | Role/semantic | Keyboard | Focus management | Announcements | Alternative representation | Verification (all NOT TESTED) |
| --- | --- | --- | --- | --- | --- | --- |
| DataTable | `table`+`caption`; `aria-sort` | Tab to headers/links; `Enter` | Focus remains after sort (on header button) | "Sorted by X ascending" polite | — | axe, NVDA table nav |
| Trace waterfall | Composite "tree grid"-like: implement as APG **Tree View** semantics on label column (`role=tree/treeitem`, `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded`, `aria-selected`) with bars as `aria-hidden` visuals; each treeitem's accessible name: `"<service> <operation>, <duration>, <status>, starts +<offset>"` | See page matrix keyboard map | Roving tabindex; inspector open → focus stays on tree unless user presses `Tab`; closing inspector returns | "Selected span payments POST /charge, 412 ms, error" | **Tree and Table views** convey identical data (table: columns Service, Operation, Start offset, Duration, Status, Kind) | Playwright keyboard E2E (J-03), SR script |
| Span tree | APG Tree View | `↑↓→←`, `Home/End`, `Enter` | roving | as above | Table view | same |
| Span inspector | region; `<dl>` for key/value; `<details>` sections | Tab through; copy buttons | On open via keyboard focus moves to inspector heading only when user presses Tab/Enter on "Open inspector" button, not on arrow selection | none (not live) | — | SR |
| TimeSeriesChart | `figure` + `figcaption` (measure, unit, window, population, n) ; plot `role="application"` **avoided** → use `role="group"` + `aria-roledescription="chart"` + focusable plot with arrow-key readout | `←/→/Home/End` | focus on plot; readout in caption | throttled polite: "13:05, p95 412 ms, 482 requests" (only on key navigation, not pointer) | **Always-available `<table>` toggle**; gaps = rows with "no data" | SR + keyboard |
| Histogram | same as chart | same | same | same | table | same |
| ServiceGraph | `figure`; SVG `role="img"` hidden from AT when table present? **No:** nodes are `tabindex` buttons inside a `group` ("Service map, N services, M dependencies"), edges `aria-hidden` (listed in table) | Tab to graph, arrows to neighbors, `Enter` select, `+/-/0`, `Esc` | Selection sets focus to details heading on `Enter` only | "Selected orders → inventory: 124 traces, 3 with errors" | **Edge table always rendered & primary for AT**; node list; mobile table-first | graph fixture + keyboard (J-04) |
| EdgeTable | DataTable | as DataTable | Row select does not steal focus | polite "Edge selected" | — | same |
| TimeRangePicker | `button aria-haspopup="dialog"`; dialog with radio group + date inputs | Arrows in radios, Tab, `Enter`, `Esc` | return focus to trigger | "Time range set to last 1 hour" | typed absolute | Playwright |
| ServiceSelector | APG combobox (list autocomplete) | `↑↓ Enter Esc Alt+↓` | active-descendant | result count polite | — | SR (known fragile → test) |
| CursorPager | button | `Enter/Space` | focus first new row | "50 more traces loaded" polite | — | Playwright |
| Dialog | `role=dialog aria-modal`, label+description | Tab trap, `Esc` | initial: Cancel for destructive; restore | — | — | axe + manual |
| Drawer/Sheet | as Dialog (modal) on mobile; sidebar drawer `nav` | `Esc` | restore | — | — | manual |
| Toast | `role=status` | actions focusable; no auto-dismiss while focused | not stolen | polite | — | manual |
| StatusBadge | text+icon | n/a | n/a | text read as part of name | — | review |
| CopyButton | button + live region | `Enter/Space` | stays | "Copied trace ID" | select-text fallback | Playwright |
| FilterChips | buttons "Remove filter …" | Tab | after remove focus next chip or "Clear all" or filter input | "Filter removed, 12 traces" polite | — | Playwright |
| HeroTraceLine / Journey | decorative (`aria-hidden`) / tabs APG | tabs: `←/→`, play/pause | skip control first | step caption `aria-live=polite` only on user action | text description of journey in DOM | manual, reduced-motion |
| Code snippets | `pre` + `tabindex=0` when scrollable | | | "Copied" | — | axe |
| Session-expired / 404 / 500 | main with `h1` | | focus to `h1` | — | — | manual |

## 3. Per-route checklist (each must satisfy §1 + any extra)
| Route | Extra requirements |
| --- | --- |
| `/` | Hero `h1` single; animation pausable/skippable; reduced-motion parity; link purpose clear (CTA labels not "click here"); FAQ disclosure semantics; language attr; heading outline (one h1, sections h2) |
| `/docs/*` | Landmarks, TOC `nav`, `aria-current`, code block focus/copy, headings anchors with accessible names |
| `/login` | Error/denied announced (`role=alert` once), focus to heading, no cognitive tests, `returnTo` not exposed in announcement |
| `/demo*` | Banner is part of landmark `banner`/`complementary` and not removable; all `/app` trace & table requirements |
| `/app` | Panels = `section` with headings; KPI null-state text; chart tables; polling announcements limited; freshness text not live per tick |
| `/app/onboarding` | Ordered steps; status transitions announced once; copy buttons |
| `/app/traces` | Filter form labelled; table semantics; sorted-within-loaded labelled; chips; pager announcements; no focus loss on load-more |
| `/app/traces/[id]` | Tree/Table alternatives; inspector; `span=` deep link focuses and scrolls to node on load **without stealing focus from heading unless user came via `#span`**; notices as status list; keyboard path "next error span" |
| `/app/services` | Table; search labelled; population note linked via `aria-describedby` |
| `/app/services/[name]` | Operation disclosure rows; edge tables; chart table alternative |
| `/app/map` | **Edge table + node list as full alternative**; graph widget doc; no pan/zoom drag-only; mobile table-first; `prefers-reduced-motion` irrelevant (no animation) |
| `/app/analytics` | Chart tables; compare toggle `aria-pressed`; sample-count text; insufficient-sample messaging |
| `/app/settings` | Form patterns; confirm dialog; success status; disabled controls explained (not just greyed) |

## 4. Testing approach (gates)
1. **Automated:** `@axe-core/playwright` on every route × states (loading/empty/error/partial) × 360 and 1440 — zero critical/serious. (**NOT TESTED**)
2. **Keyboard-only E2E:** J-02, J-03, J-04 scripted (AC-A11Y-01). (**NOT TESTED**)
3. **Manual SR passes:** VO+Safari (trace page, map table, chart table), NVDA+Firefox (traces list, settings dialog). Findings logged with severity. (**NOT TESTED**)
4. **Visual/zoom:** 360/375/768/1024/1440, 200% zoom, 400% reflow, text-spacing override, forced-colors (Windows High Contrast: focus ring and status icons use system colours via `forced-color-adjust: auto`, SVG uses `currentColor`/`CanvasText`), landscape. (**NOT TESTED**)
5. **CVD simulation** of chart palette and status colours. (**NOT TESTED**)
6. **Independent a11y reviewer** (spec §14: not the author) signs off; "no critical WCAG 2.2 AA violations" is the claim limit.

## 5. Known risks / open items
- Waterfall as treeview with a large row count: accessible-name verbosity and virtualization (`aria-setsize/posinset` correctness) — verify at M4 (risk A-1).
- Combobox and graph widgets are historically screen-reader fragile; table alternatives are the supported path (A-2).
- Sticky headers + bottom sheets vs WCAG 2.4.11 need geometry tests (A-3).
- Chart readout announcements can spam: throttle to key-driven only (A-4).

## M7 results (2026-11-25, branch `m7-ui`)

What was checked, with limits. This is not a conformance claim.

**Automated.** axe-core via Playwright with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` on every route and key states (see `docs/testing/ui-acceptance.md` §5): 0 violations in the final build; earlier rounds found and fixed `definition-list`, `link-in-text-block`, `label-content-name-mismatch`, nested `main`. axe covers a subset of WCAG; passing it is not evidence of accessibility.

**Keyboard-only pass** (`node scripts/ui-acceptance.mjs keyboard`: real key presses, recording every focus stop, its role/name, whether a visible focus indicator exists (computed outline/box-shadow), and whether it is in the viewport; I then read the traces). Chromium on macOS; no assistive technology.
- **Skip link:** first Tab stop on every page is "Skip to main content"; Enter moves focus to `main`.
- **Visible focus:** every focus stop across all journeys had a computed outline or shadow (0 stops without one; this checks the CSS, not contrast of the ring, which comes from `--tf-focus` on white).
- **J-02 (slow span):** `/app` → "View example" under p95 reached after 19 Tab stops (skip link + 7 nav + range presets + service scope + refresh + KPI links) → Enter opens the trace with the span selected (1 selected treeitem, inspector populated). No trap.
- **J-03 (error span):** `/app/traces?status=error`: first trace link is stop 29 (nav, range, filters, chips, Refresh come first); Enter opens it; "Next error span" is reachable by Tab; Enter moves focus to the error treeitem and selects it; ArrowUp/ArrowDown/Enter work; one Tab from the tree reaches the inspector's Close button and Shift+Tab returns (no trap); Escape clears the selection and leaves focus on the tree row. The tree/waterfall is a single Tab stop (roving tabindex).
- **J-04 (map → trace):** the graph is one Tab stop (listbox); ArrowRight/Enter selects a service and shows details; Escape clears; the next Tab goes to the edge filter input (no trap); the edge-table row button selects an edge. **Finding (not fixed):** the *Details* panel (with the supporting-trace links) is *before* the edge table in DOM order, so after selecting an edge with the keyboard the links are 18 Shift+Tab stops *behind* the focus, not ahead. The panel is an `aria-live` region so the selection is announced, but the links are awkward to reach. Suggested fix: place Details after the table, or move focus to a "Details" heading link on selection.
- **Cost of repeated navigation:** 19–29 Tab stops precede the first data control on app pages because the skip link targets `main` and the filters live inside it. Acceptable but a "skip to results" target would shorten J-03.
- **Docs:** copy button reachable in 15 stops; the mobile "Docs menu" disclosure and "On this page" disclosure are native `<details>`.

**Fixed because of this round:** map listbox options were inside an `<svg>` with implicit `role=img` (children presentational, so assistive tech may not expose the options): now `role="none"` on the svg (`0bdc38c`); layout shift on mobile docs (`d27656c`); page-level overflow at 768/1024 (`33dc65b`); missing list markers and clipped waterfall durations at 1024 (`c3f5e49`).

**Screen reader: NOT TESTED.** A VoiceOver pass needs a person at the machine (VoiceOver is turned on with a system shortcut, speaks aloud and takes keyboard focus; an agent cannot observe what is announced, only the accessibility tree). No attempt was made to drive it. What exists instead: `docs/testing/a11y-snapshots/*.yml` (Playwright `ariaSnapshot`):
- Waterfall/tree: `tree "Spans of trace …"` with `treeitem` per span, names like "error GET /checkout gateway 21.9 ms", `level`, `expanded`, `selected` states.
- Inspector: `complementary` named by the span name, headings, `dl` terms/definitions, copy buttons with a hidden status region.
- Edge table: native `table` with caption, `columnheader` buttons, row names that include source/target/basis/counts; select button named "Select edge gateway to orders".
- Graph: `listbox` with one `option` per service ("gateway 904 req · 25.0 %").
- Chart: `figure` → `group` "…use arrow keys to step through buckets" plus a `polite` readout paragraph; "View as table" exposes every value.
- Live regions on `/app`: three chart readouts (`aria-live=polite`), freshness text is deliberately not live, "Load more" count and chart readouts announce on user action only.
**Manual VoiceOver script to run** (Safari and Chrome): waterfall — rotor to Landmarks/Trees, arrow through spans, check the error announcement and that `Enter` announces the inspector; edge table — table navigation (VO+arrows) and the select buttons; live updates — chart arrow keys, "Load more", copy buttons, onboarding connection state; sign-in states.

**Not covered:** zoom/reflow beyond 200% on three routes, text-spacing overrides, forced-colors, prefers-contrast, target-size measurement of every control (24 px minimum is applied via CSS but not measured), motion beyond the hero (no other animation exists), cognitive checks, and any test with real users.
