# Pryielle AI — PROGRESS.md

App: **Pryielle AI** (`com.pryielle.ai`) — Pryielle MSG ke SAME Firebase project se connected. Naya Firebase nahi.

## Batch plan (total 6)
| # | Batch | Status |
|---|-------|--------|
| 1 | Project scaffold + Sign-in screen + Home screen + shared Firebase + PROGRESS.md | ✅ DONE |
| 2 | Real login: Google + email, `users/{uid}` check (ban / owner approval), logout, menu drawer | ✅ DONE |
| 3 | AI chat engine: MSG `api/ai.js`, chat screen, voice/mic | ✅ DONE (v1.2.0) |
| 4 | **AI app ka update system** (config/app se check, popup, download, install, "done" yaad rakhna, native `UpdaterPlugin.java`) | ✅ DONE (v1.3.0) |
| 5 | **MSG app me**: Admin me "Pryielle AI update" publish, `deleteOldApks` fix, MSG Settings me **"Pryielle AI download"** (MSG v2.15.0) | ✅ DONE |
| 6 | Android build (Capacitor/GitHub Actions), manifest permissions + FileProvider + MainActivity plugin register, icon/splash, testing checklist | ✅ DONE (v1.3.0, code-level; APK build GitHub par chalana baaki) |

## Batch 1 — kya bana
- `SignIn.tsx`: logo + "Pryielle AI", hero illustration, "The AI for problem solvers", **Continue with Google**, OR, email field, legal text. Dark theme (#141414).
- `Home.tsx`: menu icon (left), ghost icon (right), orange starburst, **"<Naam> returns!"**, "Free plan · Upgrade" pill, composer (+, "Type or hold to talk", mic, wave button).
- Menu icon dabane par abhi sirf sheet: naam, email, **Sign out**, version.
- `firebase.ts` + `scripts/make-config.mjs`: `config/google-services.json` (MSG wali hi) se config banata hai → same project `pryielle-msg`.
- Google login MSG jaisa hi (`@capacitor-firebase/authentication`).

## Batch 2 — kya bana (v1.1.0)
- `lib/account.ts`: MSG ke SAME `users/{uid}` doc ko live sunta hai (naya collection nahi, firestore.rules me koi change nahi).
- `Gate.tsx` screens: account missing (pehle MSG me banao), approval pending, rejected, banned, connect error + Retry. Owner (`workwithpryielle@gmail.com`) in sab se bypass.
- Email login: email likho -> wahi Google account (login_hint). Login ke baad email match check, galat account par auto sign-out. Same uid, same MSG account. (Firebase me naya Email provider on karne ki zarurat nahi.)
- Home: naam MSG profile se, avatar, side drawer (profile, New chat, Sign out, version).
- Naye account sirf MSG app se bante hain (approval/device rules wahi), AI app me nahi.

## Batch 3 — kya bana (v1.2.0)
- `lib/aiUrl.ts` + `lib/ai.ts`: MSG ke SAME `api/ai.js` (Vercel) ko call karta hai — naya server/key nahi. Auth = Firebase ID token, quota/ban/approval/admin settings (`aiAdmin/main`) wahi MSG wale.
- `Home.tsx`: composer ab chalta hai. Text/Enter -> AI jawab (markdown: bold, code block, bullets), copy button, typing spinner. Text likhte hi wave button -> **Send (arrow)**.
- **+** button: Photo/file (image, PDF <3MB, text/code) max 4, ya Camera.
- **Mic (dictate)**: pehle phone ka SpeechRecognition; na ho (Android WebView) to awaaz server (`voice` action) se text banwata hai (1 quota use).
- **Wave button = Voice mode** (`Voice.tsx`): mic VAD -> AI -> bolke jawab (TTS), beech mein bolke rok sakte ho. Har turn chat mein save.
- Chats sirf is phone par (localStorage, max 60): drawer me **Chats list**, New chat, delete. Ghost icon = **Incognito** (save nahi hoti).
- Header/greeting same screenshot jaisa; chat shuru hote hi greeting hat ke messages dikhte hain.

## Batch 4 — kya bana (v1.3.0) — AI app ka update system
- `config/app` (MSG ka hi doc) ko live sunta hai. AI app ke fields MSG ke `update*` se ALAG: `aiUpdateVersion`, `aiUpdateTitle`, `aiUpdateNotes`, `aiUpdateUrl`, `aiUpdateParts`, `aiUpdateSize`, `aiUpdateForce`. (`lib/appConfig.ts`)
- APK pieces Firestore me `updates/ai-<version>/parts/0000..` (prefix `ai-` => MSG ke `updates/<version>` se takrao nahi; firestore.rules me **koi change nahi**, `updates/{ver}` rule dono pe lagta hai).
- `lib/update.ts`: download (pieces ya link, Drive/Dropbox link auto direct), APK ke andar ka version check, installer kholna, done/skip yaad rakhna, resume par reconcile.
- `components/UpdateModal.tsx` + `UpdateGate` (`App.tsx`): login ke baad naya `aiUpdateVersion` > app version ho to popup (Update now / Baad me; force ho to Baad me nahi). Progress bar, "Install allow" permission message.
- `lib/device.ts`: `Updater` Capacitor plugin. `native/UpdaterPlugin.java` (package `com.pryielle.ai`) MSG wale ka copy — Batch 6 me `android/app/src/main/java/com/pryielle/ai/` me jayega + `MainActivity` me `registerPlugin(UpdaterPlugin.class)`.
- Version `package.json` me 1.3.0. **Har naye APK se pehle version badhana** warna update install nahi hoga.

## Batch 5 — kya bana (MSG v2.15.0, AI zip me kuch nahi badla)
- MSG zip: `Pryielle-MSG-v2_15_0-AI-LIVE.zip`. Details MSG ke PROGRESS.md "v2.15.0" me.
- `aiUpdate*` fields MSG config me; Admin -> Update tab me AI APK publish; MSG Settings -> "Pryielle AI download" (download/update/open).
- AI APK ko Admin me version dena = AI app ke `package.json` version ke barabar.
- Dhyan: purana MSG (v2.14) `setConfig` karega to `aiUpdate*` mita dega. Sab admin devices par MSG v2.15 hi use karo.

## Known / pending
- Hero illustration SVG me hath se banayi hai (screenshot ke close). Original asset do to Batch 6 me exact swap.
- Heading font abhi Georgia fallback (Claude jaisa serif ke liye baad me font bundle).

## Batch 6 — kya bana (v1.3.0)
- **Batch 4 ka code zip me nahi tha** (batch3 zip v1.2.0 thi), isliye MSG ke update system se dobara port kiya: `lib/device.ts` (Updater plugin), `lib/appConfig.ts` (`aiUpdate*` live), `lib/update.ts` (download pieces/link, APK ka version+package check, done/skip yaad), `components/UpdateModal.tsx` (`UpdateGate` popup, `App.tsx` me login+approval ke baad), CSS `.upd*`.
- `native/UpdaterPlugin.java` (package `com.pryielle.ai`) + `native/MainActivity.java` (`registerPlugin(UpdaterPlugin.class)`).
- `scripts/patch-android.mjs` (`npx cap add android` ke baad): permissions (INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, CAMERA, VIBRATE, REQUEST_INSTALL_PACKAGES), FileProvider + `file_paths.xml` (cache `updates/`), Java files copy, fixed debug keystore, Google-login lib flag, `versionCode` = package.json version se (1.3.0 -> 10300), icons + splash.
- `.github/workflows/build.yml`: Actions -> **Build APK** -> artifact **Pryielle-AI-apk** (`Pryielle-AI-v1.3.0.apk`). Vercel ka alag domain ho to repo Variable `VITE_AI_BASE_URL` set karo.
- Icons/splash: orange starburst, dark #141414 (`resources/icons`, `resources/splash.png`).
- `android-keystore/debug.keystore` = MSG wala hi => SHA-1 `DD:A4:B0:8F:AF:72:47:15:D2:41:2E:5A:98:FA:F0:B7:80:1D:6B:70`.
- Dhyan: `config/google-services.json` me abhi sirf `com.pryielle.msg` client hai. Patch script build ke liye AI client copy kar deta hai, par **Google login tab tak error 10 dega** jab tak Firebase me AI app add karke nayi file na daalo (SETUP step 1).
- Sandbox me npm nahi chal paya, isliye `npm run build` / Gradle yahan test NAHI hue. Pehla GitHub Actions run hi asli test hai.

## Testing checklist (phone par)
1. APK install -> app khule, splash dark, icon orange starburst.
2. Google login (MSG wale account se) -> Home "<Naam> returns!". Galat/naya account -> "pehle MSG me banao" gate. Owner bypass.
3. Chat: text bhejo -> jawab (markdown, copy). Quota/ban MSG jaisa.
4. + button: Photo, Camera (permission popup aaye), PDF <3MB. Mic dictate (permission). Wave = Voice mode, bolke jawab.
5. Incognito (ghost) chat save na ho; normal chat drawer me list/delete.
6. Update: MSG Admin -> Update -> AI APK (version > 1.3.0, package.json jitna) publish -> AI app me popup -> Update now -> progress -> "Install allow" -> installer -> naya version. Dobara popup na aaye. "Baad me" chale, force me na chale.
7. MSG Settings -> "Pryielle AI download" installed/open/update sahi dikhe.
8. Logout -> SignIn; app band/khol -> session bana rahe.

## SETUP (ek baar)
1. **Firebase console -> pryielle-msg (wahi project) -> Add app -> Android -> package `com.pryielle.ai`**, SHA-1 `DD:A4:B0:8F:AF:72:47:15:D2:41:2E:5A:98:FA:F0:B7:80:1D:6B:70` (MSG wala), phir **google-services.json** download karke `config/` me replace karo (Google login ke liye zaroori).
2. GitHub me **private** repo banao, is zip ka sab kuch (hidden `.github` folder ke saath) upload karo.
3. Actions -> **Build APK** -> Run workflow -> ~8-10 min baad Artifacts -> `Pryielle-AI-apk`.
4. Naya APK banane se pehle `package.json` ka version badhao.

## Dev run (browser)
`npm install && npm run dev`
