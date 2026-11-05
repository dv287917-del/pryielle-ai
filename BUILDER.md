# Secret AI Builder — design + setup

## Flow
Secret code (chat) -> server check -> `builderRequests/{uid}` (pending) -> owner approve -> `builderAdmins/{uid}.approved=true`
AI JSON banata hai -> `validateFeatureConfig` (shared/featureSchema.js) -> `appFeatures/draft` -> Preview (sirf builder) -> Publish -> `appFeatures/live` (+ `appFeaturesHistory/{version}`) -> sabko "Update Now".

## Firestore (sab likhna SIRF server/Admin SDK se, client se nahi)
| Path | Padh sakta | Likh sakta |
|---|---|---|
| `appFeatures/live` | har signed-in user (get) | server |
| `appFeatures/draft` | builder (owner / approved) | server |
| `appFeaturesHistory/{version}` | builder | server |
| `builderRequests/{uid}` | apni request / owner | server create, owner update |
| `builderAdmins/{uid}` | apna / owner | owner |
| `aiAdmin/builder` (existing rule: owner only) | owner/server | owner |

Doc fields: config (`shared/featureSchema.d.ts` ka `FeatureDoc`) + `version` (int, +1 har publish), `publishedAt`, `publishedBy`, `active`.
Unpublish = `appFeatures/live` ko khali config + naya version (sabka app purana look par wapas).

## Secret code (ek baar setup)
Code plain text me kahin save nahi hai. Firebase Console -> Firestore -> `aiAdmin` collection -> naya doc id `builder`:
- `salt` (string): `2939541b102f487367e88058`
- `codeHash` (string): `1fefdc546b8d139315b978ac162cca1af04ec2479983437a0ee170a854c3d191`
Server check: sha256(`salt:code`) == codeHash (timing-safe). Code badalna ho to `node scripts/make-secret.mjs "naya code"` se naya salt+hash banao.

## Whitelist (AI ye hi bana sakta hai)
Theme: accent/bg/surface/text/muted (hex), font (system|serif|mono|rounded), radius 0-28.
Flags: max 20 boolean. Blocks: max 12 — banner, badge, button, card, hero, chips, toggle, sirf allowed slots me (home-top, home-hero, home-suggestions, chat-top, drawer).
HTML / script / http link / unknown type = validator hata deta hai. Test: `node scripts/test-schema.mjs`.

## Permission rule (Batch 2 me lag gaya)
Approved builder: generate + draft + preview. **Publish / Unpublish / Rollback sirf owner** (`workwithpryielle@gmail.com`).

## Rules deploy dhyan
`firestore.rules` MSG ke saath SAME Firebase project me hai. Pura file overwrite karne se pehle check karo ki MSG ka latest rules isi file jaise hain; warna sirf "AI Builder (v1.4.0)" wala naya block purane rules me paste karo.

## Server actions (Batch 2) — `POST /api/ai`, header `Authorization: Bearer <Firebase ID token>`
| action | Kaun | Body | Result |
|---|---|---|---|
| `builderStatus` | approved user | — | `{owner, builder, liveVersion, liveActive, hasDraft, draftUpdatedAt}` (builder ko hi poora) |
| `builderGenerate` | builder | `prompt`, `base?` (`draft`/`live`/`new`), `attachments?` | `{config, warnings, updatedAt}` + draft save |
| `builderDiscard` | builder | — | draft delete |
| `builderPublish` | **owner** | `expectUpdatedAt?` | `{version,...}` live + history |
| `builderUnpublish` | **owner** | — | khali config, naya version |
| `builderRollback` | **owner** | `version` | purana config naye version me |
Errors: 403 (access nahi), 404 (draft/version nahi), 409 (draft badal gaya), 422 (AI config invalid). Test: `node scripts/test-builder.mjs`.

## App side (Batch 3)
- Slots: `home-top`, `home-hero`, `home-suggestions`, `chat-top`, `drawer`. Blocks: banner, badge, button, card, hero, chips, toggle.
- Naya publish: users ko "Update now" popup; unpublish/rollback par popup nahi, seedha wapas. Builder: drawer > "Draft preview" (sirf usi ko dikhta hai).
- Built-in flags: `hideUpgrade`, `compact`, `hideCopy`. Text me `{name}` = user ka pehla naam.
- Test: `node scripts/test-runtime.mjs`.

## Secret code + approval (Batch 4)
1. User chat me code type kare -> server pehchane -> `builderRequests/{uid}` pending (chat me jawab: "Request owner ko bhej di").
2. Owner: drawer > "🛠 Builder access" > Approve (-> `builderAdmins/{uid}.approved=true`) ya Reject. Approved builder ke drawer me "🧪 Draft preview" aa jaata hai.
3. Revoke: usi screen se. Reject/revoke ke baad max 3 requests total.
Code kabhi chat history me nahi rehta (🔒 ••••) aur Gemini ko nahi jaata. `builderStatus` response me non-builder ko `request` (apni state) milti hai.

## Builder screen (Batch 5)
Drawer > "🛠 Builder" (builder/owner). Prompt (+ photo/PDF reference) -> draft -> "👁 Preview" -> (owner) "🚀 Publish". Owner: Unpublish, History > Rollback. Sab destructive kaam confirm ke baad. Approved builder publish nahi kar sakta (server bhi 403 deta hai).

## Testing (Batch 6)
`npm test` — schema, server, app runtime aur static consistency (198 checks). GitHub Actions APK se pehle yehi chalata hai. `npm run typecheck` alag se (CI me nahi). Deploy checklist + troubleshooting: `PROGRESS.md` ke end me.

