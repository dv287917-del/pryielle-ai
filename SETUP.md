# IronRoses MSG: APK banane ka setup (sirf ek baar, ~15 min)

App ka code, design aur GitHub build sab ready hai. Tumhe sirf apna Firebase (free) jodna hai.
**Repo PRIVATE rakhna** (usme tumhari Firebase file aur signing key hogi).

## Step 1: GitHub repo
1. github.com par **New repository** → naam `pryielle-msg` → **Private** → Create.
2. Is zip ke andar ka *sab kuch* (hidden `.github` folder ke saath) repo mein upload karo.
   Sabse aasan: **GitHub Desktop** use karo, ya phone/PC par repo page → *Add file → Upload files*.

## Step 2: Firebase project
1. console.firebase.google.com → **Add project** → naam `pryielle-msg` (Analytics off kar sakte ho).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable** → apna email do → Save.

## Step 3: Android app jodo (sabse important)
1. Project Overview → **Android icon** → Package name: `com.pryielle.msg`
2. **SHA-1** box mein ye paste karo:
   `DD:A4:B0:8F:AF:72:47:15:D2:41:2E:5A:98:FA:F0:B7:80:1D:6B:70`
3. Register karo → **google-services.json download karo**.
4. Ye file GitHub repo ke `config/` folder mein upload karo (naam bilkul `google-services.json`).
   (Agar pehle download kar li thi aur SHA-1 baad mein joda, to file dobara download karke replace karo.)

## Step 4: Database
**Build → Firestore Database → Create database** → Production mode → location `asia-south1 (Mumbai)`.

## Step 5: Rules
Firestore → **Rules** tab → purana sab hata ke is repo ki `firestore.rules` file ka poora text paste karo → **Publish**.

## Step 6: APK build
GitHub repo → **Actions → Build APK → Run workflow**. ~8–10 minute baad run ke andar **Artifacts → IronRoses-MSG-apk** download karo, zip kholo, `IronRoses-MSG.apk` phone mein install karo (Unknown sources allow karna padega).

Aage jab bhi code change karoge aur push karoge, APK apne aap dobara banegi.

---

## Optional: app band hone par bhi notification
Abhi message aate hi notification tab aata hai jab app khula ho ya background mein ho. App poori tarah band ho tab bhi chahiye to Firebase **Blaze plan** (card lagta hai, chhote use mein usually free) + `functions/` deploy karna hoga:
`npm i -g firebase-tools && firebase login && firebase deploy --only functions`

## GIF
Abhi 2 GIF/memes hain (`src/assets/gifs/`). Naya add karne ke liye file wahan daalo aur `src/lib/gifs.ts` mein ek line jodo.


## Naya update: Firestore Rules dobara Publish karo (zaroori)
Is version mein admin panel, news, stories aur anti-cheat hai. Firebase Console → Firestore Database → **Rules** → purana sab hata ke `firestore.rules` ka naya poora text paste karo → **Publish**. Bina iske admin panel, news, stories aur videos kaam nahi karenge.

Admin account: `workwithpryielle@gmail.com` se Google login karo, Me tab mein **Admin Panel** dikhega.


## Floating window (game ke upar chat)
App mein Home ya Me tab mein **FLOATING WINDOW** button dabao. Pehli baar Android "Display over other apps" permission maangega, usse ON karo, wapas aake button dobara dabao. Phir chat ek chhoti window mein game ke upar aati hai. Upar ki bar se drag karo, **–** se bubble banao, **⤢** se size badlo, **✕** se band karo.


## v2.7.0 deploy steps
1. `firestore.rules` poora Firebase Console -> Firestore -> Rules mein paste -> Publish (alarms collection ke liye zaroori).
2. Code push -> GitHub Actions APK. Purane users ko Admin -> Update se naya APK do.
3. Alarm app band hone par bajane ke liye: `cd functions && npm i && firebase deploy --only functions` (Blaze plan). Bina iske sirf khule app par alarm bajta hai.
4. Phone mein notification permission allow honi chahiye.


## AI (Gemini) setup — v2.10.1
1. aistudio.google.com/apikey -> Create API key (free).
2. `firestore.rules` poora Firebase Console -> Firestore -> Rules mein paste -> Publish.
3. `cd functions && npm i && firebase deploy --only functions` (Blaze plan chahiye; chhote use mein usually free).
4. App -> Admin Panel -> 🤖 AI -> key paste -> Test -> Save. Koi `secrets:set` nahi karna.
