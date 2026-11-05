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

## AI Builder (v1.4.0 — 6 batch, SAB POORE)
Design/setup: `BUILDER.md`. Secret admin feature: draft -> preview -> publish -> "Update Now", rollback.
| # | Batch | Status |
|---|-------|--------|
| B1 | Foundation: Firestore rules + schema + validator + secret code hash | ✅ DONE |
| B2 | Server: `api/ai.js` builder actions + admin check | ✅ DONE |
| B3 | App renderer + Preview + Update Now popup | ✅ DONE |
| B4 | Secret code + approval flow | ✅ DONE |
| B5 | Builder screen (chat, attach, publish/rollback UI) | ✅ DONE |
| B6 | Test + docs + version 1.4.0 | ✅ DONE |

### B1 — kya bana
- `firestore.rules`: `appFeatures/{live,draft}`, `appFeaturesHistory`, `builderRequests`, `builderAdmins` (client write band, server hi likhega).
- `shared/featureSchema.js` (+ `.d.ts`): whitelist validator, client aur server dono use karenge. `scripts/test-schema.mjs` (8 test pass).
- `BUILDER.md`: flow, tables, secret code setup (hash only, plain code kahin nahi).
- `tsconfig.json` me `shared` include.
- TODO (tum): Firestore me `aiAdmin/builder` doc banao (salt + codeHash, BUILDER.md me) aur rules deploy karo.

### B2 — kya bana
- `api/_builder.js` (naya; `_` prefix => Vercel isse alag route nahi banata). `api/ai.js` me sirf 3 chhote badlav: import, `gemini()` ko optional system override, aur `builder*` actions ka route.
- Actions (sab `POST /api/ai`, `{action, ...}`): `builderStatus`, `builderGenerate {prompt, base?: draft|live|new, attachments?}`, `builderDiscard`, `builderPublish {expectUpdatedAt?}`, `builderUnpublish`, `builderRollback {version}`.
- Admin check: owner = `workwithpryielle@gmail.com` + **verified** email. Builder = owner ya `builderAdmins/{uid}.approved == true`. Generate/Discard = builder; **Publish/Unpublish/Rollback = sirf owner**. `builderStatus` sab approved users ko chalta hai (sirf owner/builder flag; baaki data sirf builder ko).
- Generate: Gemini JSON mode (temperature 0.4) + `SCHEMA_PROMPT` + current draft/live config -> `validateFeatureConfig` -> `appFeatures/draft`. Validator fail => 422, draft nahi badalta. 1 AI quota use hota hai.
- Publish: draft dobara validate -> ek transaction me `appFeatures/live` (version +1) + `appFeaturesHistory/{version}`. `expectUpdatedAt` galat => 409 (jo preview dekha wahi publish ho). Unpublish = khali config + naya version (`active:false`). Rollback = purana version naye version number ke saath live (history dobara validate hoti hai).
- AI band (`aiAdmin/main.on=false`) hone par bhi Publish/Unpublish/Rollback chalte hain (emergency rollback); sirf Generate band hota hai.
- Tests: `node scripts/test-builder.mjs` (36 pass, fake Firestore + fake Gemini) aur `node scripts/test-schema.mjs` (8 pass).
- Dhyan: draft ek hi doc hai — do builder ek saath edit karenge to aakhri generate jeetega.
- Secret code check + approval request (`builderRequests`, `builderAdmins` approve) **B4** me; abhi `builderAdmins/{uid}.approved` Firebase Console me hath se true karke test kar sakte ho.
- Deploy: Vercel redeploy chahiye (nayi file `api/_builder.js` bhi). Env vars wahi (`GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`). Rules me B2 ne kuch nahi badla.

### B3 — kya bana (app side)
- `shared/featureRuntime.js` (+ `.d.ts`): pure helpers — theme -> CSS variables (+ contrast safety), `parseLive`, `decideUpdate`, `effectiveFlags`, `interpolate`, `safeUrl`. Node me test hota hai.
- `src/lib/features.tsx`: `FeaturesProvider` (live config sunta hai, validate karke theme/flags lagata hai, builder ke liye draft + Preview, cache `localStorage pryai.features.v1`), `applyCachedTheme()` (main.tsx me, render se pehle).
- `src/components/Blocks.tsx`: `<Slot>` (banner, badge, button, card, chips, toggle), `useHero()`, `PreviewBar`, `FeatureUpdateGate` ("Update now" popup).
- `Home.tsx`: slots `home-top`, `home-hero` (greeting badalta hai), `home-suggestions`, `chat-top`, `drawer`; drawer me builder ko "🧪 Draft preview". `send(override)` — chips/button ka prompt typed text ko nahi chhedta. `{name}` = pehla naam.
- `styles.css`: theme variables (`--accent --surface --raise --drawer --r --pill` ...) — fallback har jagah purani value, to builder ke bina app bilkul pehle jaisa.
- Update flow (sabke liye): pehli baar = chupchap lagta hai. Naya version = popup "Update now / Baad me" (Baad me = is session me chhupao, agle launch par phir). **Unpublish / Rollback / purana version = popup nahi, turant default/purane look par wapas (safety).** Popup ke rang fixed hain, theme se alag.
- Safety: client data dobara validate; unreadable rang (contrast kam) ignore (`console.warn("[builder theme]")`); koi HTML/script nahi, links sirf https.
- Built-in flags (SCHEMA_PROMPT me jode, AI ko pata hai): `hideUpgrade`, `compact`, `hideCopy` -> `<html class="fx-...">`. Baaki flags sirf toggle block ke saath matlab rakhte hain. User ka toggle choice `pryai.flags.v1` me.
- Tests: `node scripts/test-runtime.mjs` (40 pass). Typecheck loose stubs ke saath saaf (node_modules nahi the) — **asli `npm run build` / APK build abhi tumhe chalana hai**.
- Server redeploy zaroori: `shared/featureSchema.js` ka SCHEMA_PROMPT badla (api/ai.js usi ko import karta hai).
- Abhi test kaise: Firebase Console me `appFeatures/draft` ya `live` doc haath se banao (B2 ke generate se bhi draft ban jaata hai) -> app me drawer > "Draft preview". Live ke liye `version: 1, active: true` + config fields.

### B4 — kya bana (secret code + approval)
- **Code kaise kaam karta hai:** user chat me secret code type karta hai. Server (`api/_builder.js` `maybeSecret`, `api/ai.js` ke "ask" me quota ke baad) sirf chhote (<=100 char), bina attachment wale message ko `aiAdmin/builder` ke salt+hash se check karta hai (sha256, timing-safe, 30s cache). Galat = normal chat (Gemini ko jaata hai). Sahi = Gemini ko **nahi** jaata; `{text, secret:true}` wapas.
- Sahi code se sirf **request** banti hai: `builderRequests/{uid}` `{status:"pending", email, displayName, count, requestedAt}`. Access tab jab owner approve kare. Reject/revoke ke baad total 3 requests tak dobara ban sakti hai, uske baad band.
- Owner/builder ko "pehle se access hai" ka jawab; pending ko "pending hai". Code kisi doc me store nahi hota.
- App: `askAi` ab `{text, secret}` deta hai. Secret turn chat me "🔒 ••••" ban jaata hai (title me bhi code nahi), isliye aage ki history ke saath Gemini ko bhi nahi jaata.
- Owner UI: drawer me "🛠 Builder access (n)" (sirf owner) -> `components/BuilderAdmin.tsx`: Pending approve/reject, approved builders revoke, pichli requests. Sab **client se seedha Firestore** (rules me `isAdmin` ko pehle se allowed: `builderAdmins` write, `builderRequests` update) — `firestore.rules` me B4 ne kuch nahi badla. Approve = `builderAdmins/{uid}.approved=true` + request `approved` ek batch me.
- Approve hote hi us user ke drawer me "🧪 Draft preview" (builder) dikhne lagta hai (live listener). Revoke hote hi server har call par dobara check karta hai, to turant band.
- `builderStatus` ab non-builder ko apni `request` state bhi deta hai (`null/pending/rejected/...`), aur kuch nahi.
- `node scripts/make-secret.mjs "naya code"` -> naya salt+hash (code badalne ke liye).
- Tests: `node scripts/test-builder.mjs` ab 60 pass (24 naye: code match, ignore cases, request fields, re-request limit, owner/builder shortcut, cache, status).
- Dhyan: code message `askAi` se pehle ek pal ke liye local chat history me ban jaata hai (reply aate hi scrub hota hai). Network fail ho to wo turn plain text me reh sakta hai — us chat ko delete kar do. Incognito chat me ye save hi nahi hota.

### B5 — kya bana (Builder screen)
- Drawer (sirf builder/owner) -> "🛠 Builder" -> `components/BuilderScreen.tsx` (full screen). `lib/builder.ts` = server actions ke wrappers.
- Upar: back, "Live vN" / "Default look" pill, 🕘 History. Beech: chat (tumhare prompts, AI ka "draft ban gaya" + validator warnings, errors), phir **Draft** card (naam, notes, rang swatch, blocks ki list, warnings, "draft purane live par bana tha" chetavni) aur **Live** card.
- Niche: "Draft pe badlo / Live se shuru / Khali se" (kahan se edit shuru ho), attach (＋: photo/PDF/text, max 4 — design reference ke liye), prompt box. Pehle prompt idea chips.
- Buttons: **👁 Preview** (builder screen band, app me draft dikhta hai + pill "Band karo"), **Hatao** (draft discard), **🚀 Publish** (sirf owner; baaki ko "Publish sirf owner karta hai"), **⏹ Unpublish** (sirf owner), History me **Rollback** (sirf owner). Publish/Unpublish/Discard/Rollback sab pe "Haan/Nahi" confirm. Publish `expectUpdatedAt` bhejta hai (jo draft dekha wahi publish; badla to 409 ka message).
- History: `appFeaturesHistory` ke aakhri 20 version (`orderBy version desc`), LIVE ka nishaan, rollback ka "rollback of vN".
- `shared/featureRuntime.js`: `summarizeConfig`, `draftStale` (+ 5 test, ab 45 pass).
- Server me B5 ne kuch nahi badla. Dhyan: `api/ai.js` ka `maxDuration` 60s hai aur Gemini ka timeout 100s; bahut dheemi AI call par Vercel pehle kaat dega (504) — us case me phir se bhejo.
- Typecheck loose stubs ke saath saaf; asli `npm run build` tumhe chalana hai.

### B6 — kya bana (final)
- `package.json` version **1.4.0** (versionCode patch-android.mjs se khud: 10400). Naya APK ka version phone se bada hona zaroori hai.
- `npm test` = 4 test files, kul **198 check**: schema 8, builder server 60, app runtime 45, consistency 85. Workflow (`build-apk.yml`) me "Builder tests" step jodi — test fail to APK nahi banegi.
- `scripts/test-consistency.mjs`: schema <-> renderer <-> CSS <-> rules <-> server ke static cross-check (naya block/slot/flag/CSS variable jodke dusri jagah bhoolo to pakad leta hai; mutation se verify kiya).
- `npm run typecheck` (tsc) jodi. **CI me nahi** (vite build typecheck nahi karta, aur ye pehle kabhi chala nahi) — pehli baar apne PC par chalake dekho.
- `builder.ts`: purana Vercel server ho to saaf message ("naya api/ai.js aur api/_builder.js deploy karo").
- `functions/ai.js` (Firebase Functions wali purani copy) index.js se export nahi hoti, app Vercel `api/ai.js` use karta hai — Builder me uska koi role nahi.

## Deploy checklist (v1.4.0, ek baar)
1. **Firestore rules:** `firestore.rules` ka "AI Builder (v1.4.0)" block Firebase Console > Firestore > Rules me daalo (MSG ke latest rules ke saath mila ke) > Publish.
2. **Secret code doc:** Console > Firestore > `aiAdmin` > doc id `builder` > fields `salt` (string) aur `codeHash` (string) — BUILDER.md me diye hain; naya code chahiye to `node scripts/make-secret.mjs "code"`.
3. **Vercel redeploy:** `api/ai.js`, `api/_builder.js`, `shared/` badle hain. Env vars wahi (`GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`).
4. **APK:** project GitHub me daalo, Actions se APK banao (v1.4.0). Pehle se install app ke upar Update Now se bhi ja sakta hai (naya `aiUpdateVersion` publish karke).
5. **Pehla test (owner):** drawer > 🛠 Builder > "orange theme + welcome banner" > Preview > Publish > dusre phone par "Update now" popup.
6. **Pehla test (builder):** dusre account se chat me secret code -> "Request owner ko bhej di" -> owner: drawer > 🛠 Builder access > Approve -> us account me 🛠 Builder aa jata hai (publish nahi kar sakta).

## Troubleshooting
- "AI server purana hai" -> Vercel redeploy nahi hua.
- Builder row nahi dikhti -> `builderAdmins/{uid}.approved` true hai? (owner ko email verified chahiye.)
- Draft ban hi nahi raha (422) -> prompt chhota/saaf karo; ya Gemini ne galat JSON diya, phir bhejo.
- Publish pe 409 -> beech me draft badla; Builder me draft card dekho, phir publish.
- Theme laga par kuch rang nahi badle -> "unreadable" rang app ne jaan-boojh ke ignore kiye (console me `[builder theme]`).
- Kharab publish ho gaya -> Builder > History > Rollback, ya ⏹ Unpublish (sab turant default look par, bina popup).

