# PROGRESS (mega update v2.4.0) — dusri ID / dusre session ke liye

Is file ko padh ke wahin se aage badhao. Original wishlist `MEGA-UPDATE-WISHLIST.md` mein hai (17 features).

## Batch 1: backend + security  → DONE (code likha, build GitHub Actions pe hoga)
- [x] 6  Signup approval: Google login → ID banti hai → `approval:"pending"` → owner Admin → Requests tab se Approve / Reject (reason) → user Rejected screen pe Appeal bhej sakta hai. Rules mein enforce (`ok()` in firestore.rules). Files: `src/components/Gate.tsx`, `AdminExtra.tsx` (RequestsTab), `lib/security.ts`, `Setup.tsx`, `App.tsx`.
- [x] 5  Ban: device id + IP ban (`bans` collection), VPN block ("VPN not available"), ek phone = ek account (`deviceOwners`). Native: `native/SecurityPlugin.java`. Admin → Security tab + Users tab (Ban panel).
- [x] 2  In-app update: Admin → Update tab: APK file chuno (≤45MB, Firestore mein pieces) ya link; heading "Mega Update Here" editable; app mein UPDATE NOW → progress bar → installer. Native: `native/UpdaterPlugin.java`. Lib: `lib/update.ts`.
- [x] 3  Owner chat viewer: Admin → Chats tab (user search → unki chats → messages), deleted/edited ka original `audit` collection se. Alerts se "Chat dekho".
- [x] 13 Auto-detect: gaali / threat / scam / spam → `alerts` → Admin → Alerts tab + phone notification (`lib/moderation.ts`). Receiver phones bhi check karte hain.
- [x] 12 Anti-cheat (jitna bina server ke ho sakta hai): message key whitelist, name/text size limits, device id lock, protected fields, approval gate on every read/write.
- [ ] 11 Custom followers → Batch 2 mein (followers system ke saath)

## Batch 2: UI  → PARTLY DONE
- [x] 1  Custom sticker emoji (24, screenshot se crop): `src/assets/emoji/e01..e24.png`, `lib/emoji.ts` (token `:e07:`), `components/Rich.tsx`. Thread emoji panel = sirf ye stickers (tap = turant send). Sirf bhejte/aate waqt `sticker-pop` animation, history mein static. Reactions mein bhi sticker chal te hain.
- [x] 5  Notes: Instagram jaisa full-screen editor (X, Note… bubble, palette = bubble colour, music / location / GIF pills, Share with friends = Everyone/Close friends, Share). `components/Notes.tsx`, NoteDoc mein place/gif/tone/audience.
- [x] 7  Settings and activity: `components/Settings.tsx` (search, sections, sub-pages: Notifications, App lock, Privacy, Blocked, Theme, Permissions, Accessibility (reduce motion, large text), About, Log out). Profile -> menu icon se khulta hai. `Me.tsx` ab sirf Edit profile hai.
- [x] 10 Followers system (v2.5.0): Posts / Followers / Following (squads ki jagah). `follows/{follower}_{target}` docs, counts `getCountFromServer` se. Follow button + FollowList (tap on count). Posts = lifetime story count (`postsCount`, rules mein sirf +1). Files: `lib/follow.ts`, `components/FollowUI.tsx`, `Profile.tsx`, rules `match /follows`.
- [x] 11 Admin custom counts: Admin -> Users -> har user mein CUSTOM COUNTS (followers/following/posts: 1M, 2.5M, 500k). Khali + SET = asli count wapas. Fields `followersCustom/followingCustom/postsCustom` (rules mein sirf admin likh sakta hai).
- Known: private account pe follow request approval nahi hai (follow seedha ho jata hai). Build test nahi hua (npm blocked), sirf syntax + helper tests pass.
- [ ] 14 share-profile QR design + "Share profile" ki jagah theme | 16 edit profile (song, links, banners, pronouns, gender)
- [ ] 17 baaki animations / smoothness pass

## Batch 3: horror + speed → TODO
4 home banner voice | 7 bhootni + real moon | 8 jump-scare video (secret) | 9 lag fix + GIF fast load

## Deploy steps (user ko karna hai)
1. `firestore.rules` poora Firebase Console → Firestore → Rules mein paste → Publish (ZAROORI, warna approval/ban kaam nahi karega).
2. Repo mein naya code push → GitHub Actions APK banayegi. `package.json` version 2.3.0 hai.
3. (Optional) `functions/` deploy for owner push when app closed (Blaze plan).
4. Pehli baar purane users: koi kuch nahi karna, wo auto "approved" maane jate hain.

## Known limits (honest)
- Ye serverless Firebase app hai: modified client ko 100% rokna ho to Cloud Functions + Play Integrity chahiye. Abhi rules + multi-phone checks hain.
- IP ban shared mobile IP par dusron ko bhi rok sakta hai. VPN detection phone ke andar se hota hai (koi bhi VPN app pakdi jati hai).
- Build yahan (sandbox) test nahi hua: npm registry blocked thi. Pehla GitHub Actions build errors de to PROGRESS.md mein note karke fix karo.

## v2.4.1: update popup loop FIX
- Wajah: popup `updateVersion > APP_VERSION` se aata tha; APP_VERSION package.json se bake hota hai. Agar naye APK mein package.json ka version nahi badha to install ke baad bhi popup aata rehta tha.
- Fix: native `Updater.info()/inspect()` (UpdaterPlugin.java). Install se pehle APK ke andar ka asli version padha jata hai; install ke baad (app replace hone par) `pry-upd-done` yaad rakha jata hai (`lib/update.ts` reconcileUpdate) aur wo version dobara popup nahi dikhata. Admin publish pe version <= apna version ho to rok deta hai.
- Naya update dena ho: package.json version badhao → push → APK → Admin → Update mein wahi version + APK.

## v2.7.0 (ye session) — Emoji HQ, themes, Emergency alarm, About
- [x] Emoji stickers dobara high-quality: bade screenshot (1110px) se cut, 320x320 transparent, 7% padding (crop nahi). Picker 5 column, bade tiles; `.sticker-img` class; pop animation 1.18x (clip nahi hota).
- [x] About simple: logo + naam + version + "Made by Pryielle" (credit wala tamasha hata diya).
- [x] 12 art themes (pattern + gradient art, sirf colour nahi): Northern Lights, Galaxy, Sakura, Synthwave, Sunset, Matrix, Frost, Love, Royal Gold, Dark Forest, Candy, Lava. `[data-theme]` + `.theme-art` layer (`ui.tsx` Aurora). Settings mein preview swatches.
- [x] Admin -> 🚨 Emergency tab: har user ka live status — Online / App band (app ne khud bataya) / Switch Off (app khula tha, phir bina bataye gayab). Upar wohi jinka app band ya phone off. 🚨 se alarm: 5 / 30 / 60 ya custom seconds. Files: `lib/alarm.ts`, `components/Emergency.tsx`. User doc mein `appState` (active/background).
- [x] Alarm user ke phone par: app khula -> `AlarmHost` full-screen red alarm + hosh.mp3; app band/background -> native `AlarmService` (foreground service, alarm stream max volume, vibrate) — `native/AlarmService.java`, `AlarmPlugin.java`, `AlarmMessagingService.java`. FCM data push `type=alarm` ke liye `functions/index.js` `notifyAlarm` (Blaze + `firebase deploy --only functions`). Rules: `alarms/{uid}` (admin likhe, user sirf ack).
- Known: Android **Force stop** ke baad koi app (FCM bhi) nahi chalta -> alarm tab bajega jab user app dobara kholega (pending alarm, 6 ghante tak valid). Bina Cloud Function ke band app par alarm nahi bajega (sirf khule/background-alive app par).
- Known: "Switch Off" andaza hai (heartbeat band + app ne background nahi bataya) — net band / crash / force-stop bhi yahi dikhega.
- Baaki (agla batch): QR share profile + theme, edit profile fields, banner voice, bhootni+moon, secret jump-scare video, GIF fast load.
- ChatGPT wala v2.6.0 base nahi liya; v2.5.0 se aage badhe.

## v2.7.1: build fix
- Error: `AlarmMessagingService.java: cannot find symbol RemoteMessage / cannot access FirebaseMessagingService` (+ 2x "cannot be converted to Context").
- Wajah: `firebase-messaging` sirf capacitor-push-notifications ke andar tha (`implementation`), :app module ko nahi dikhta tha.
- Fix: `scripts/patch-android.mjs` ab `implementation "com.google.firebase:firebase-messaging:23.3.1"` app/build.gradle mein add karta hai (idempotent, mock gradle par test kiya).

---
# v2.10.0 (AI update) — progress
- [x] Batch 1: group chat `/ai ...` (functions/ai.js `aiGroupReply`), funny short replies, any language, polite on abuse, glowing AI bubble in Thread.tsx
- [x] Batch 2: private AI chat screen (src/components/AiChat.tsx, entry: Home > "Pryielle AI") — photo/camera/PDF/text-code files, copy/share, history on phone
- [x] Batch 3: voice input (Web Speech if the WebView supports it, else keyboard mic tip), "Hindi mein translate" chip
- [x] Batch 4 (safe part): emergency alarm max 3600 s (1 hour). NOT done on purpose: un-closable / un-deletable / no switch-off (non-consensual device lock)
- [x] v2.10.1: AI Claude se **Gemini** par shift (see neeche). Ab secret set nahi karna: key Admin -> 🤖 AI tab se.
- [ ] Batch 5: squad features (invite code, leaderboard)
- [ ] Batch 6: game section (web game in WebView)
Notes (v2.10.0, purana): model/Claude wali config ab use nahi hoti.

## v2.10.1 — AI = Gemini (sirf AI ka kaam, baaki features nahi chhue)
- `functions/ai.js`: Claude API hata di, Gemini `generateContent` (header `x-goog-api-key`). Default model `gemini-3.5-flash`; 404 par auto `gemini-flash-latest`; 500/503 par retry. Photo/PDF = `inlineData`, text file = text part. Safety-block aur galat key/429 ke liye Hinglish messages.
- Key + settings Firestore `aiAdmin/main` mein (rules: sirf admin). Fields: apiKey, model, on, dailyLimit, mode, lang, length, temperature, instructions. Functions admin SDK se padhte hain, users ko key nahi milti. `defineSecret` hata diya.
- Admin -> 🤖 AI tab (`components/AiAdmin.tsx`, `lib/aiAdmin.ts`): key paste (masked, show/hide), Test button (seedha Gemini ko call), model, 6 modes (Funny/Friendly/Serious/Teacher/Coder/Gamer), bhasha, jawab length, custom instructions (2500 chars), roz ki limit, creativity, ON/OFF.
- Deploy: 1) `firestore.rules` Firebase Console mein paste + Publish. 2) `firebase deploy --only functions` (Blaze plan). 3) Naya APK (version 2.10.1). 4) App -> Admin -> AI -> key paste -> Test -> Save.
- Build yahan (sandbox) nahi hua (npm blocked): functions/ai.js ka mock-fetch test pass; React files ka sirf syntax/type check stub ke saath.
- [ ] Baaki: animations batch 2 (swipe-reply, squad theme/photo, deleted msg restore, admin feature list, tap-effect) — user ke "start" bolne par.
