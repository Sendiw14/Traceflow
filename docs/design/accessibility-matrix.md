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
