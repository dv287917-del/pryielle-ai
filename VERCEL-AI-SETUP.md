# Pryielle MSG — Vercel AI migration

## Vercel project
- `vercel.json` ab Vite/build/output khud set karta hai (preset 'Other' hone par bhi chalega).
- Root directory: `./`

## Required server-side Environment Variables
1. `GEMINI_API_KEY` — Gemini key from Google AI Studio.
2. `FIREBASE_SERVICE_ACCOUNT_JSON` — the complete Firebase service-account JSON for the SAME Firebase project used by `config/google-services.json`.

Add both to Production (and Preview only if needed), then redeploy. Do not put either secret in GitHub, `VITE_*` variables, frontend code, or Firestore. Do not use the public `google-services.json` as the service-account JSON; they are different files.

## Firebase AI functions
The app now sends private AI and group `/ai` requests to Vercel `/api/ai`. `functions/index.js` no longer exports the old AI trigger/callable. If `aiAsk` or `aiGroupReply` is already deployed in Firebase, delete those two old functions in Firebase Console after confirming Vercel AI works, otherwise old triggers may continue running / incur charges. Other Firebase functions (push notifications and alarms) are separate and are not removed.

## Before public launch
- Verify Firebase Admin service account belongs to the same project and has Firestore access.
- Confirm `aiAdmin/main` settings exist and AI is enabled.
- Test private AI, image/PDF/text attachments, group `/ai`, disabled AI, and daily limits.


## APK ke liye zaroori (v2.10.2)
APK ke andar `/api/ai` relative URL kaam nahi karta. `src/lib/aiUrl.ts` mein `FALLBACK_BASE` apne Vercel domain par set karo (ya GitHub Actions build mein `VITE_AI_BASE_URL` do), phir naya APK banao. Server par CORS on hai.
