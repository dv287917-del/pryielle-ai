# Opening UI redesign — progress
Rule: sirf opening UI badalni hai. App ka baaki code mat kholo/mat chhedo. Purana PROGRESS.md ignore karo.

## Plan (4 batch)
1. Screen 1 — Welcome: ghoomti photos ka circle + "Inspired people" + "Get Started"  ✅ DONE
2. Screen 2 — Pryielle: pastel bg, rangeen gole, "Pryielle" handwriting animation  ✅ DONE
3. Transition: Get Started dabane par Screen 1 -> Screen 2 smooth, phir app  ✅ DONE
4. Polish + new app logo + final zip  ✅ DONE

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

## Batch 3 (done)
- Start.tsx: phase "welcome" -> "reveal" (380ms) -> "name" (+980ms). Screen 2 is wrapped in a fixed layer that stays MOUNTED across reveal->name (no restart of animations)
- welcome.css: photos spiral (rotate+scale to 0) into center, center photo pulses and vanishes, text sinks; Screen 2 opens as a circle (clip-path iris) from the button position (50% 86%)
- Verified in headless Chromium (frames at 0/.3/.65/1.0s), no JS errors
- Fixed: box-sizing on .wl-root/.wl-bottom

## Batch 4 (done)
- App logo = user ka cloud-with-eyes icon (uploaded 48369.png), cropped corner-safe
  - src/assets/brand/logo.png (512, rounded) — Shell/AiLive/Screen 2 sab yahi use karte hain
  - resources/icons/mipmap-*/ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png (full-bleed art) + store-icon.png
- Screen 2 top-center: squiggle ki jagah ye logo (pop-in + halka float)
- Timers cleanup on unmount (Start.tsx, PryielleScreen.tsx); reduced-motion support for transition + handwriting
- Syntax-checked all 3 TSX files; rendered in headless Chromium, no JS errors

## Note for build
- Launcher icon: adaptive foreground is full-bleed artwork; agar background color (#07060d) kahin set hai to foreground use cover kar leta hai
- Screen 2 se app me jaane ke liye abhi kisi bhi gole par tap karna padta hai (auto-enter nahi)

## Fix round (after batch 4)
- Purani rose loading screen hata di: src/components/Boot.tsx ab sirf saaf safed bg (error panel ke liye children rakhe); App.tsx me forced 1200ms boot delay -> 0; capacitor.config.ts splash bg #051a96 -> #ffffff
- Handwriting ~2.5x tez (SPEED=0.4, total ~3s); strokes ke shuru ke faltu dots fix (opacity 0 jab tak draw na ho)
- Screen 2 par ab saaf "Start" button (likhai ke baad aata hai) -> app me jaata hai; gole tap karna bhi chalta hai
- Native Android splash (agar koi drawable ho) alag hai; patch-android.mjs ko chhua nahi
