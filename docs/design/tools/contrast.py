#!/usr/bin/env python3
"""WCAG 2.x contrast ratios for docs/design/design-tokens.md. Usage: python3 contrast.py  (stdlib only)."""
def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
def lum(h):
    h = h.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126*_lin(r) + 0.7152*_lin(g) + 0.0722*_lin(b)
def ratio(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)

BG = {'paper': '#FFFFFF', 'canvas': '#F7F9FC', 'sunken': '#EEF1F6', 'signal-tint': '#EAF1FF',
      'success-tint': '#E6F5EC', 'warning-tint': '#FFF4E0', 'error-tint': '#FDECEC', 'violet-tint': '#F3EDFF'}
TEXT = {'ink': '#151A25', 'ink-2': '#3A4356', 'ink-3': '#5B6578', 'signal-strong': '#1D4ED8', 'signal': '#2563EB',
        'violet': '#7C3AED', 'violet-strong': '#6D28D9', 'success': '#0F7B4A', 'warning-text': '#8A5300', 'error': '#C0262D'}
UI = {'control-border': '#7D879B', 'focus-ring': '#1D4ED8', 'signal': '#2563EB', 'success-fill': '#15803D',
      'warning-fill': '#B45309', 'error-fill': '#C0262D', 'violet': '#7C3AED', 'chart-teal': '#0E7490',
      'chart-magenta': '#BE185D', 'chart-slate': '#475569', 'chart-sky': '#0369A1'}
ON_FILL = {'white on signal': ('#FFFFFF', '#2563EB'), 'white on signal-strong': ('#FFFFFF', '#1D4ED8'),
           'white on ink': ('#FFFFFF', '#151A25'), 'white on violet-strong': ('#FFFFFF', '#6D28D9'),
           'white on success': ('#FFFFFF', '#0F7B4A'), 'white on warning-text': ('#FFFFFF', '#8A5300'),
           'white on error': ('#FFFFFF', '#C0262D')}
EXTRA = {'ink-disabled (#9AA3B5) on paper': ('#9AA3B5', '#FFFFFF'), 'border hairline (#D5DAE3) on paper': ('#D5DAE3', '#FFFFFF'),
         'grid line (#E3E7EE) on paper': ('#E3E7EE', '#FFFFFF')}

def table(title, fg, bgs):
    print(f'\n## {title}\n| token | hex | ' + ' | '.join(bgs) + ' |\n|' + '---|' * (2 + len(bgs)))
    for n, f in fg.items():
        print(f'| {n} | {f} | ' + ' | '.join(f'{ratio(f, b):.2f}' for b in bgs.values()) + ' |')
if __name__ == '__main__':
    table('Text on surfaces (need >= 4.5)', TEXT, BG)
    table('Non-text UI on surfaces (need >= 3.0)', UI, {k: BG[k] for k in ('paper', 'canvas', 'sunken')})
    print('\n## Text on filled controls (need >= 4.5)')
    for k, (f, b) in ON_FILL.items(): print(f'| {k} | {ratio(f, b):.2f} |')
    print('\n## Intentionally below threshold (decorative / disabled / exempt)')
    for k, (f, b) in EXTRA.items(): print(f'| {k} | {ratio(f, b):.2f} |')
