# Pryielle Light UI — kaam kahan tak hua + baaki batches

Rule (har AI ko ye do): sirf UI/styling badlo. Logic, Firebase, Admin panel, Secret, Login/Lock/Setup ko mat chhedo.
Theme scope: sab kuch `.pry-ui` class ke andar (src/pryielle-ui.css). Colors CSS variables se aate hain
(`text-paper` = dark text, `bg-ink` = white). Reference look: Start.tsx + PryielleScreen.tsx (welcome.css, pryielle.css).
Naye helpers: src/components/PryArt.tsx (PryBg, PryBlob, usePryTheme).
Pattern: `const pry = usePryTheme();` -> `pry ? naya markup/class : purana` taaki dusre themes na tootein.

## DONE (Batch 1)
- Theme "Pryielle (Light)" default (lib/util.ts), purane themes Settings me ab bhi chunne ko hain
- Animated background (grid, sky rays, tairte gole, sparkles), logo header, glass buttons
- Floating dock (safed glass + kaala sliding pill), Home hero + stats + actions + status + list
- Chats list (white card rows, spring entrance), search pill, empty states (pyare gole), Find, Squads
- Chat screen basic: pastel grid wall, glass header, bubbles, composer (CSS se)
- Overlays jo `.pry-ui` me hain: News, Requests, Edit profile, Settings, Notes, Pro, CloseFriends, ProfileSheet, Group/Join sheets, Notifications

## BAAKI
### Batch 2 — Chat screen polish (Thread.tsx) ✅ DONE
Bubbles (bade gol kone + tail), spring entrance, date chips, reply quote, reactions, typing dots (neela/gulabi/peela), composer buttons, sheets ke rounded top, 'Say hi' gola. Baaki: voice/image bubble andar ka design (VoiceBubble/MediaBlock) aur long-press menu agar chahiye to dobara dekho.
### Batch 3 — Profile tab + Settings (Profile.tsx, Me.tsx, Settings.tsx, FollowUI.tsx)
Profile top ko hero-card jaisa (sky gradient + blobs), stats pills, tabs underline ko spring, Settings rows ko `.pry-ic-b` pastel icon bubbles.
### Batch 4 — Stories + Notes (Stories.tsx, Notes.tsx)
Stories strip ring (blue-pink gradient), note bubbles; Notes.tsx me hard-coded dark hex colors light ke hisaab se.
### Batch 5 — Sheets/Panels (Sheets.tsx, Panels.tsx)
Group/Join/News/Pro cards me hard-coded rang (`bg-black/..`, `text-white`) check karo; Panels.tsx ka HauntedBg (ProSheet) light screen par theek karo.
### Batch 6 — AI + YouTube (AiChat.tsx, AiLive.tsx, YoutubeView.tsx)
Abhi ye dark hi hain (Shell me `.pry-ui` ke bahar). Light karna ho to Shell.tsx me inhe `<Pry on={pry}>` me wrap karo aur hard-coded rang theek karo.
### Batch 7 — Final test
Phone par har tab + dark theme (Settings se) check; `data-perf="low"` me animations band hone chahiye.

## Chhua nahi gaya (jaan-bujhkar)
Admin.tsx, AdminExtra.tsx, AiAdmin.tsx, LiveControl.tsx, Secret.tsx, Horror.tsx, Auth/Setup/Lock/Gate.
