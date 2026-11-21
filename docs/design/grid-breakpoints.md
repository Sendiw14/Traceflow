# TRACEFLOW — Grid and Breakpoints (M1-D1)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §9.4 (360 / 375 / 768 / 1024 / 1440)

## Breakpoints (min-width, mobile-first)
| Name | Width | Test viewport(s) | Columns | Margin | Gutter | Max content |
| --- | --- | --- | --- | --- | --- | --- |
| `xs` | 0–374 | **360** | 4 | 16 | 16 | fluid |
| `sm` | 375–767 | **375** (also 414/430 spot-check) | 4 | 16 | 16 | fluid |
| `md` | 768–1023 | **768** | 8 | 32 | 24 | fluid |
| `lg` | 1024–1439 | **1024** | 12 | 32 | 24 | 1200 |
| `xl` | ≥ 1440 | **1440** (public max 1280 content) | 12 | 48 | 32 | 1280 public / 1440 app |

Additional required checks: 200% zoom at 1440 (acts as ≈720 CSS px → `md` layout; no page-level horizontal scroll), 400% reflow at 1280 (≈320 px, WCAG 1.4.10), landscape phone (≈ 667×375 and 812×375), short viewport 1440×600, tall 768×1366.

## App shell
| ≥ 1024 | 768–1023 | < 768 |
| --- | --- | --- |
| Left sidebar 240 px (collapsible to 64 px icons+tooltips), top bar 56 px with breadcrumb, global time range, service scope, freshness | Sidebar becomes drawer (button in top bar); same top bar | Top bar 56 px: menu button, page title, time range sheet; bottom: none (no tab bar, avoids phantom nav) |
| Content max 1440, panels on 12-col grid | 8-col grid, panels stack ≤ 2 up | 4-col, single column |

## Public site
Hero uses asymmetric 12-col composition (text cols 1–7, illustration cols 6–12 overlapping intentionally ≥ lg); below `md` the illustration sits under the headline as a static or skippable animation. Sections: full-bleed paper/canvas alternation with 1px hairline; content ≤ 1280.

## Overflow policy
No page-level horizontal overflow at any listed width. Allowed, signalled inner scroll regions: (1) waterfall time area (scroll container with visible scrollbar affordance, keyboard-focusable `tabindex=0`, `aria-label`), (2) wide data tables (sticky first column, shadow hint, same focus rule), (3) code blocks. Each has an accessible non-visual equivalent (tree, table row details). Long unbroken strings (trace IDs, attribute values) use `overflow-wrap:anywhere` in inspectors and truncation + tooltip in tables.

## Density
App tables 40 px row (comfortable) / 32 px (compact toggle, not default; ≥ 24 px target preserved). Mobile rows 56 px with stacked two-line content.

## Containers
Use container queries for panels (chart, table) so they adapt to sidebar collapse; viewport media queries only for shell. Chart minimum width 280 px; below that switch to table.
