# IronRoses MSG
Haunted Free Fire chat app. React + Firebase + Capacitor. APK GitHub Actions se banti hai, `SETUP.md` dekho.

## v2.1 changes
- Admin Panel → **Shortcuts** tab: chat ke niche wale quick shortcuts add / edit / reorder / ON-OFF / delete (Firestore `shortcuts`).
- Instagram style animated blue tick (`VerifiedBadge`) aur fire wala Premium badge (`ProBadge`) — `src/components/ui.tsx`.
- Group chat mein sender ke naam ke saath badges, Admin stats mein Verified count.
- **Zaroori:** `firestore.rules` Firebase Console mein dobara paste karke Publish karo (naya `shortcuts` rule).

## v2.2 changes
- Instagram jaisa Chats tab (search, Notes row, Messages/Requests, camera icon) + icon-only bottom dock.
- **Notes** (60 letters + optional song, 24h; Pro 48h). Reply / reaction bhej sakte ho.
- Instagram jaisi Profile (apni + sabki): avatar + note, 3 stats, bio, Edit/Share, tabs. Bio ab edit hoti hai.
- Blue tick (16-spike seal) aur PRO crown screenshot jaise, animated.
- Roles: Owner (auto, admin email), Admin, Officer. Admin Panel → Users → ROLE se set karo.
- Admin Panel → **Update**: naya version + APK link publish karo, sabko "Update App" popup dikhta hai (Force option bhi).
- **Zaroori:** `firestore.rules` dobara Publish karo (notes, role, shortcuts).
- Naya APK banate time `package.json` ka `version` badhana mat bhoolo, warna update popup baar-baar aayega.

## v2.3 changes (Mega Update, batch 1: security + control)
- **Signup approval:** naya user Google login → ID banata hai → request owner ke Admin → **Requests** tab mein aati hai. Approve ho to hi app khulta hai. Reject karte time reason likho; user Rejected screen se **Appeal** bhej sakta hai.
- **Ban:** Users tab → Ban → reason + Device ban + IP ban. VPN chalu ho to "VPN not available". Ek phone par ek account (Security tab mein ON/OFF).
- **In-app update:** Admin → Update → APK file chuno (ya link), heading likho (Mega Update Here), Publish. Sabke app mein popup → UPDATE NOW → app ke andar download + install.
- **Owner moderation:** Admin → **Alerts** (gaali / threat / scam / spam auto-detect, phone notification) aur **Chats** (kisi bhi user ki chat, deleted/edited ka original bhi).
- **Zaroori:** `firestore.rules` dobara Publish karo. Naya APK banate time `package.json` version badhao.
- Baaki features ka status `PROGRESS.md` mein.
