# Opening UI redesign — progress
Rule: sirf opening UI badalni hai. App ka baaki code mat kholo/mat chhedo. Purana PROGRESS.md ignore karo.

## Plan (4 batch)
1. Screen 1 — Welcome: ghoomti photos ka circle + "Inspired people" + "Get Started"  ✅ DONE
2. Screen 2 — Pryielle: pastel bg, rangeen gole, "Pryielle" handwriting animation  ✅ DONE
3. Transition: Get Started dabane par Screen 1 -> Screen 2 smooth, phir app  ⏳ NEXT
4. Polish + error check + final zip

## Batch 1 (done)
Files:
- src/components/Start.tsx (rewritten; props same: me, onStart)
- src/components/WelcomeFaces.tsx (new; illustrated portraits)
- src/components/welcome.css (new; all animations, classes start with wl-)
Notes:
- Photos: 10 illustrated portraits orbit, center = user ka avatar (fallback illustration)
- Animation: fly-in pop, orbit entrance spin, continuous slow orbit, per-tile floating, ripples, button shine, tap-wiggle, exit scatter
- Button abhi seedha onStart (540ms exit anim ke baad) call karta hai
- Subtitle copy: "Apne Free Fire dosto ke saath chat karo, sab kuch ek hi jagah."

## Batch 2 (done)
Files:
- src/components/PryielleScreen.tsx (new) — Screen 2
- src/components/pryielle.css (new) — classes wl2-*
- src/components/Start.tsx (small edit): phase state "welcome" | "name"; Get Started -> 540ms exit -> PryielleScreen; blob tap -> onStart()
Notes:
- "Pryielle" = 11 hand-made single-line SVG strokes (stroke-dashoffset), sequential write ~5s, grey gradient dark->light, i-dot pops, subtitle fades in after
- Top: sun rays (sway), glass buttons (flower spins, menu), logo squiggle draws itself
- Blobs: blue (sparkle eyes), pink, yellow (smile) float, blink; tap any -> expands full screen -> app opens
- Previewed in headless Chromium at 390x844: looks right

## Batch 3 TODO
- Smooth Screen1 -> Screen2 transition (shared bg fade, orbit photos converge to center / blobs rise as screen 1 leaves)
- Check back/status-bar colors, safe-area on notch phones
- Optional: skip button / auto-enter after few secs (ask user)

## Batch 4 TODO
- Polish speeds, reduced-motion, final error check, final zip
