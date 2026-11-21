# TRACEFLOW — Component Inventory (M1-D3)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §8.3
Scope rule (spec §8.3): no abstractions beyond usage. Each component below is used by ≥ 1 route in `page-matrix.md`; ones used once are marked **(single-use, inline until reused)**. Nothing is built; all test status **NOT TESTED**. Data contracts reference `api/openapi.yaml` schema names.

**Conventions.** Props are listed as `name: type` (TypeScript-level contract; generated API types are consumed, never redefined). `state` = visual/behavioral states. Every interactive component supports: `default, hover, focus-visible, active, disabled` unless noted. Focus ring per tokens. Test ID root = `data-testid` base. Perf/anim impact: **L**ow / **M**edium / **H**igh (per `motion-spec.md` budgets).

## A. Shell and navigation
| Component | Props / data contract | Keyboard & focus | States | Responsive | Test ID | Perf/anim |
| --- | --- | --- | --- | --- | --- | --- |
| `BrandHeader` / `Wordmark` | `variant: 'public'\|'app'` | Wordmark is a link `/`; one tab stop | default | collapses links into menu < 768 | `header` | L |
| `AppSidebar` + `MobileNav` | `items: {label, href, current}[]` (only implemented routes) | `nav` landmark; arrow keys not required (plain links); drawer: focus moves to first item, trap, `Esc` closes, focus returns to trigger | expanded, collapsed(64px), drawer-open | drawer < 1024 | `nav.sidebar`, `nav.drawer` | L (220–300 ms slide) |
| `Breadcrumb` | `crumbs: {label, href?}[]` | `nav aria-label="Breadcrumb"`, `aria-current="page"` on last | truncated middle on mobile | collapses to parent link < 768 | `breadcrumb` | L |
| `TimeRangePicker` | `value: {range}\|{from,to}`; presets `15m,1h,6h,24h,7d`; custom absolute (max 7 d, validated) | Popover button; presets in radio group; custom fields with labels; `Enter` apply, `Esc` cancel; announces applied range | closed, open, invalid, applied | bottom sheet < 768 | `time-range` | L |
| `ServiceSelector` | `options: ServiceName[]` (from `listServices`), `value?` | Combobox (ARIA 1.2 pattern): type to filter, `↑↓`, `Enter`, `Esc`, clear button | loading, empty, error(options failed → free-text off) | full-width sheet < 768 | `service-select` | L |
| `FreshnessIndicator` | `generatedAt: Nanos`, `lastSpanReceivedAt: Nanos\|null`, `polling: boolean`, `onRefresh` | Refresh button; text via `aria-live="off"` (not announced each tick); stale (> 3 intervals) → warning text | fresh, stale, paused(hidden tab), refreshing, error | wraps | `freshness` | L |
| `PrivacyBanner` / `DemoBanner` | `kind: 'demo'\|'private'` | Not dismissible for demo; non-focusable text | — | full width | `banner.demo` | L |
| `SessionExpiredView`, `NotFoundView`, `ErrorView` | `returnTo?`, `correlationId?` | Focus moves to `h1` on mount | — | — | `system.*` | L |

## B. Data display
| Component | Props / data contract | Keyboard & focus | States | Responsive | Test ID | Perf/anim |
| --- | --- | --- | --- | --- | --- | --- |
| `DataTable` (accessible) | `columns: {id, header, sortable, align, render}[]`, `rows`, `getRowHref?`, `caption`, `sort`, `onSort`, `density` | Native `<table>`, `<caption>`, `scope`; sortable header = `<button>` with `aria-sort`; link in first cell; no `role=grid` unless cell navigation is needed (not V1) | loading(skeleton rows), empty-*, error, partial-row | stacked rows < 768 (`display:block` pattern with `data-label`) | `table.<name>` | M (rows > 200 → virtualization decision per measure) |
| `SortHeader` | `label`, `direction: asc\|desc\|none` | `Enter/Space` toggles, announces "sorted descending" | — | — | `table.sort` | L |
| `CursorPager` | `nextCursor: string\|null`, `loading`, `onLoadMore` | "Load more" button; after load, focus first new row; live announce count | idle, loading, end ("No more traces in this window") , error | full width | `pager` | L |
| `FilterBar` + `FilterChips` + `FilterDrawer` | filters `{service?, status, minDuration?, range}`; chip per active filter with remove button | Chips are buttons "Remove filter service=orders"; drawer traps focus; "Clear all" | default, active, invalid(inline error) | drawer < 768 | `filters` | L |
| `StatusBadge` | `status: 'ok'\|'error'\|'unset'\|'partial'\|'skew'\|'estimate'` | Non-interactive; icon `aria-hidden`, text visible | — | — | `badge.status` | L |
| `KpiTile` | `label`, `value`, `unit`, `population: Population`, `nullReason?` | Non-interactive; `title` text not sole carrier (note rendered in DOM) | value, insufficient-samples, empty | grid 2×2 mobile | `kpi.<name>` | L |
| `Skeleton`, `EmptyState`, `ErrorState`, `PartialNotice` | `variant`, `problem?: Problem`, `onRetry`, `children` | Error: `role="alert"` once; Empty/Partial: `role="status"`; Retry button focusable | — | — | `state.*` | L |
| `CopyButton` | `value: string`, `label` | Button; on success "Copied" visible + polite live region 1×; no clipboard API → select text fallback | idle, copied(2 s), failed | ≥ 24 px | `copy` | L |
| `Toast` | `kind`, `message` | Region `role="status"`; actions focusable; auto-dismiss ≥ 6 s, pause on hover/focus, no toast for errors that need action | — | bottom on mobile | `toast` | L |
| `Dialog` / `ConfirmDialog` | `title`, `description`, `confirmLabel`, `destructive` | Modal: focus trap, initial focus = Cancel for destructive, `Esc` cancels, restore focus, `aria-modal`, scroll lock | open, submitting, error | full-height sheet < 768 | `dialog` | M (scrim fade 150 ms) |
| `InlineFormField` | `label`, `help`, `error`, `control` | `label`↔`for`, `aria-describedby`, `aria-invalid`, error on blur+submit | default, error, disabled, readonly | full-width | `field.<name>` | L |
| `CodeSnippet` | `code`, `language`, `copyable`, `ariaLabel` | `tabindex=0` when overflowing; copy button | default, copied | inner scroll | `code` | L (no runtime highlighter on client; build-time highlight) |
| `SessionBanner` (public-demo notice reuse) | see `DemoBanner` | — | — | — | — | L |

## C. Charts and trace views
| Component | Props / data contract | Keyboard & focus | States | Responsive | Test ID | Perf/anim |
| --- | --- | --- | --- | --- | --- | --- |
| `TimeSeriesChart` (SVG) | `series: {id,label,color,points:{t:bigint, v:number\|null}[]}[]`, `unit`, `window`, `population`, `bucketSeconds`, `markers: bool` | Plot is one `tabindex=0` composite: `←/→` prev/next bucket, `Home/End`, readout in a visible + `aria-live="polite"` (throttled) caption; "View as table" button (`aria-pressed`) toggles `<table>` of every value; legend as buttons toggling series (`aria-pressed`) | loading, empty, gap (null), insufficient, error | min 280 px width then table-only | `chart.<name>` | M (SVG ≤ ~600 points; no entry animation; single optional 200 ms fade of readout) |
| `Histogram` (needs **R-3**) | `buckets: {lowerNs, upperNs, count}[]`, `unit` | Same as chart; each bar addressable; table alternative | as above | as above | `chart.histogram` | M |
| `Sparkline` (**not in V1 unless API adds per-service series; see R-4**) | — | — | — | — | — | — |
| `Waterfall` | `spans: Span[]` (sorted), `treeIndex`, `axis: {start:bigint,end:bigint}`, `selectedSpanId`, `onSelect`, `labelColumn: 'resizable'` | Composite widget (see page matrix keyboard map): roving tabindex rows, `aria-activedescendant`-free (focus actual row), `aria-level/posinset/setsize` via tree semantics shared with `SpanTree`; time area `tabindex=0` for inner scroll only | loading, windowed(large), late-update indicator | label column sticky, inner scroll | `trace.waterfall` | **H** (virtualize rows ≥ ~500; measure at M4; bars are plain divs/SVG rects) |
| `SpanTree` | same data; expand/collapse state per span | WAI-ARIA `treeview`: `↑↓→←`, `Home/End`, `Enter` select, `*` expand siblings **not bound**; type-ahead not V1 | expanded/collapsed, group "Parent span not received" | default view < 768 | `trace.tree` | M–H |
| `SpanInspector` | `span: Span`, `resource: Resource`, `scope: InstrumentationScope` | Region (`aria-labelledby` span name); sections as `<details>`/headings; attributes as `<dl>`; `AnyValue` renderer: string/bool/int(string→BigInt)/double/bytes(base64 length shown)/array/kvlist nested/empty; long values wrap + "Copy value"; `truncated` flag shown | empty (no span selected: "Select a span"), partial (dropped counts) | bottom sheet < 768 | `trace.inspector` | M |
| `TraceNotices` | derived from `completeness`, `quality`, `freshness` | `role=status` list (not alerts), each with icon+text | — | stacked | `trace.notices` | L |
| `ServiceGraph` | `nodes: ServiceSummary[]`, `edges: DependencyEdge[]`, `layout` (deterministic layered, computed once), `selected` | Composite (see page matrix); pan/zoom buttons; no auto-animating layout; `Esc` clear | loading, empty, large(> 50 nodes → table-first), error | hidden < 768 (table alternative) | `map.graph` | **H** (SVG; > 50 nodes measured; no continuous physics) |
| `EdgeTable` | `edges: DependencyEdge[]` → `DataTable` instance | Row select syncs graph; sample trace IDs are links | as `DataTable` | stacked | `map.edge-table` | L |
| `EdgeEvidencePanel` | `edge: DependencyEdge` | Region; links to sample traces | — | sheet < 768 | `map.details` | L |

## D. Public site specific
| Component | Contract | Keyboard | States | Test ID | Perf/anim |
| --- | --- | --- | --- | --- | --- |
| `HeroTraceLine` | `trace: SyntheticTrace` (build-time JSON), `animate: boolean` | Decorative `aria-hidden`; text alternative adjacent; **Skip animation** button first in order | playing, finished, static (reduced motion/skip) | `home.hero.line` | M (≤ 900 ms; SVG stroke-dashoffset, GPU transform/opacity only) |
| `JourneyExplorer` | `steps: {title, spanIds, description}[]` from fixture | Tabs pattern (`←/→`, `Home/End`), play/pause button | step i, paused, static | `home.journey` | M |
| `FeatureShowcase`, `Faq` (disclosure), `DocsNav`, `Toc` | content-driven | Disclosure buttons; `aria-expanded`; `Toc` active-heading via `IntersectionObserver` (no `aria-live`) | — | `home.faq.item`, `docs.toc` | L |
| `SiteFooter` | real links only (repo, docs, license, security contact) | Plain links | — | `footer` | L |

## E. Tokens and primitives (not components)
`tokens.css` (see `design-tokens.md`), `Icon` (own set, `aria-hidden` unless standalone with `aria-label`), `VisuallyHidden`, `Stack/Grid` layout primitives only if ≥ 3 usages (decide at M5).

## F. Explicit non-inventory
Command palette / global search overlay: **not built** (spec: only "if actually implemented"; no V1 route requires it; trace-by-ID jump is a plain input on `/app/traces`). Dark-mode toggle, user-built dashboards, theming UI: out of scope.

## G. Shared gates
- Each component: story + state matrix test + axe + keyboard test (Playwright component tests) before use.
- `DataTable`, `Waterfall`, `SpanTree`, `ServiceGraph`, `TimeSeriesChart` carry the budget gates in `motion-spec.md` §6.
- No component receives raw `unknown` API data; all API values pass generated types; ns timestamps are `bigint` at the boundary (`parseNanos()` helper, single implementation).
