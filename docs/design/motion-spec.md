# TRACEFLOW — Motion Specification (M1-D3)

**Status:** DRAFT 0.1.0 (2026-11-22) · **Owner:** Sonnet · **Spec:** §9.3
**Library decision:** CSS transitions/animations for everything possible; **one** JS library (Motion, "motion" package) only for the hero sequence and journey if CSS cannot sequence it. No second animation library; no WebGL/3D (not justified). Any dependency needs an ADR/version pin at M2 (no install now). All values are targets; **measurements NOT TESTED**.

## 1. Global rules
- Animate only `opacity` and `transform` (and `stroke-dashoffset` on SVG paths). No layout-property animation (no `height/width/top/left`), except disclosure height via grid-rows technique (`grid-template-rows: 0fr→1fr`) ≤ 220 ms.
- Easing tokens: `--tf-ease-out: cubic-bezier(0.22, 1, 0.36, 1)` (entrances), `--tf-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` (moves), `--tf-ease-in: cubic-bezier(0.64, 0, 0.78, 0)` (exits); exits ≈ 70% of entrance duration.
- Duration tokens: `--tf-dur-fast 150ms`, `-base 220ms`, `-slow 300ms`, `-section 450ms`, `-hero 750ms`.
- Everything interruptible: new trigger cancels/reverses from current value (CSS transitions do this natively; Motion uses `animate()` controls `.stop()`/reverse).
- **Never** delays information: content is in the DOM and readable before animation; animation is enhancement; errors and states appear immediately (no entrance delay).
- No perpetual/looping animation anywhere (including the map, hero, backgrounds). One-shot only. Sole exception: a spinner-like activity indicator limited to `refreshing` > 400 ms, which is replaced by static text under reduced motion.
- No scroll hijacking, no scroll-linked parallax, no sticky-pinned scrub sections.
- No animation on first paint of private data routes beyond skeleton → content cross-fade 150 ms.

## 2. Reduced motion (`prefers-reduced-motion: reduce`)
Global CSS: durations → `0.01ms`, transforms removed, smooth scroll off. JS: `matchMedia` read at mount + `change` listener; Motion's `MotionConfig reducedMotion="user"` as baseline. Per item below: **Fallback**. Also provide an in-page "Skip animation" control on the hero and honour it regardless of OS setting. Static compositions must be reviewed as equal-information designs, not "broken" ones (screenshot gate: `home-reduced.png` at 5 widths).

## 3. Motion map (trigger · duration · easing · sequence · cancel · reduced-motion · mobile · budget)
| ID | Where | Trigger | Duration / easing | Sequence & behaviour | Cancel / reverse | Reduced-motion fallback | Mobile | Budget |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | `/` hero staged narrative | Page load (after fonts swap or 300 ms max wait) | total ≤ 900 ms (target 750) / ease-out | 0 ms: headline+CTAs visible immediately (opacity 1; only a 4–8 px `translateY` settle ≤ 300 ms). 100–750 ms: SVG trace line draws left→right (dashoffset), junction dots scale 0.6→1 with 60 ms stagger, labels fade. No blocking: CTAs interactive at t=0 | "Skip animation" button; any key/scroll/click jumps to end state; `pagehide` stops | Final state rendered statically, no transition | Same sequence, line shortened (fewer junctions), ≤ 700 ms | CLS 0 (reserved box), main thread ≤ 8 ms/frame, ≤ 15 KB JS beyond app bundle (measure) |
| M-02 | `/` section entry | Section enters viewport (IntersectionObserver once, `threshold 0.15`) | 350–450 ms ease-out | `opacity 0→1` + `translateY 12px→0`; children stagger ≤ 3 × 60 ms; fires once; content readable if JS fails | Not cancellable (short); skip when `scrollY` jump (anchor nav) → render final | Immediately final | Disabled stagger | ≤ 2 ms scripting per section |
| M-03 | Buttons, chips, links, rows hover | Pointer hover/press | 150–180 ms ease-in-out | Colour/background/border + 1px press translate; hover never the only affordance; **focus-visible ring is instant (0 ms) and persistent** | CSS native | Colour change only (no transform) | No hover styles on `(hover: none)` | — |
| M-04 | Sidebar collapse / mobile drawer | Button / `Esc` / outside click | 220–300 ms ease-in-out (enter), 180–220 ms ease-in (exit) | Transform translateX + scrim fade 150 ms; focus moves to first focusable on open **after** transition starts (not delayed); on close focus returns to trigger immediately | Reverse from current position | Instant toggle, focus rules unchanged | Drawer from left; scrim tap closes | — |
| M-05 | Dialog / popover / toast | Open/close | 150–200 ms ease-out | Opacity + scale 0.98→1 (dialog), translateY 4 px (popover); toast slides 8 px | Reverse | Opacity-free instant (or ≤ 50 ms fade) | Dialog becomes bottom sheet translateY 24→0 220 ms | — |
| M-06 | Trace span select / focus | Click/keyboard select | 150–250 ms ease-out | Row background + outline transition; inspector content cross-fade 150 ms; **time axis, scroll position and row order never move** | Instant replace on rapid re-select | Instant | Bottom-sheet M-05 | ≤ 1 frame jank at 500 rows |
| M-07 | Waterfall/tree expand-collapse | Toggle | ≤ 150 ms (rows fade/height step) or **none** for > 100 rows | Prefer instant for large subtrees; focus stays on toggled node | — | Instant | Instant | Never animate > 50 rows |
| M-08 | Chart hover/focus readout | Pointer move / arrow key | 100 ms | Crosshair + readout update; no tween of data | Native | Same (no movement) | Tap sets readout | — |
| M-09 | Graph node/edge hover/focus | Pointer / keyboard | 120–160 ms | Stroke width/opacity change on node+incident edges; **no path animation, no flow particles, no perpetual pulse** | Native | Same | n/a (table-first) | Layout computed once; ≤ 16 ms hover handling at 50 nodes |
| M-10 | Poll/stream refresh | Each successful refresh | 150 ms | Values update in place (no layout shift: reserved widths, tabular nums); a 1 s subtle underline pulse on **changed KPI value only if the user is not interacting**, plus text "Updated 4 s ago"; new trace rows appear **only after user presses "N new traces"** (no list jump) | Cancels on next refresh | Static timestamp text only, no pulse | Same | CLS 0 from refresh |
| M-11 | Skeleton → content | Data arrival | 150 ms cross-fade | Skeleton uses static tone (no shimmer sweep); optional 1.2 s opacity breathe 0.6↔1 **only when motion allowed** (not perpetual beyond 10 s: then static) | Replaced by content | Static skeleton | Same | — |
| M-12 | Copy / toast confirmation | Press copy | 150 ms | Icon swap check; text "Copied" persists 2 s | Next press resets | Instant swap | Same | — |
| M-13 | Journey explorer step change | Step select/auto-advance | 250–350 ms ease-in-out | Highlight on span chips + caption cross-fade; auto-advance only after user presses Play; never autoplay | Pause/resume | Step changes instant; no auto-advance | Vertical stepper | — |
| M-14 | Route transitions | Navigation | none | No page transition animation (keeps back/forward and a11y simple); skip link/focus management handles | — | — | — | — |

## 4. Performance budgets (targets, **NOT TESTED**)
- All animations 60 fps on mid-tier mobile (6× CPU throttle lab proxy); long tasks from animation scripting < 50 ms.
- Public-route JS gate: motion code split, loaded after hydration only for `/`; animation code not shipped to `/app/*` except none required.
- LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (§9.4): hero illustration is inline SVG (no network), animated asset never LCP element if it delays paint; no layout shifts from motion.
- Animated `will-change` only during animation, removed after.

## 5. Accessibility interplay
Pause/stop/hide (WCAG 2.2.2): any motion > 5 s with other content must be pausable — none planned > 1 s except optional skeleton breathe (auto-stops at 10 s) and user-started journey autoplay (has Pause). Flashing: none (< 3 flashes/s trivially). Focus never moved by an animation completing. Live regions are not updated per animation frame.

## 6. Verification plan
Playwright with `reducedMotion: 'reduce'` and `'no-preference'` on `/` (screenshot parity), trace page (axis position unchanged before/after select: assert bounding boxes), poll refresh (CLS observer = 0), traces list (no row shift when new data announced). Lighthouse lab + 6× throttle trace for hero. All **NOT TESTED**.
