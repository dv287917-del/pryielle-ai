// `npx cap add android` ke BAAD chalao: permissions, FileProvider, Updater plugin, signing, icons, splash, versionCode.
import fs from "node:fs";
import path from "node:path";

const PKG = "com.pryielle.ai";
const app = "android/app";
const res = `${app}/src/main/res`;
const manifestPath = `${app}/src/main/AndroidManifest.xml`;
const gradlePath = `${app}/build.gradle`;

// ---- 1. google-services.json ----
// Agar config/ wali file me com.pryielle.ai ka client nahi hai (Firebase me AI app abhi add nahi ki), to MSG ka client
// copy karke package badal dete hain taaki BUILD toot na jaye. Google login tab tak error 10 dega: SETUP.md step 1 karo.
{
  const j = JSON.parse(fs.readFileSync("config/google-services.json", "utf8"));
  const pk = (c) => c.client_info?.android_client_info?.package_name;
  if (!j.client.some((c) => pk(c) === PKG)) {
    const clone = structuredClone(j.client.find((c) => pk(c) === "com.pryielle.msg") ?? j.client[0]);
    clone.client_info.android_client_info.package_name = PKG;
    j.client.push(clone);
    console.log("⚠️  google-services.json me com.pryielle.ai nahi mila: MSG ka client copy kiya (build chalega, Google login ke liye Firebase me AI app add karo)");
  }
  fs.writeFileSync(`${app}/google-services.json`, JSON.stringify(j, null, 2));
}

// ---- 2. Google Sign-In lib (v6 me optional, warna launch par crash) ----
{
  const vars = "android/variables.gradle";
  let v = fs.readFileSync(vars, "utf8");
  if (!v.includes("rgcfaIncludeGoogle")) v = v.replace(/ext\s*\{/, "ext {\n    rgcfaIncludeGoogle = true");
  fs.writeFileSync(vars, v);
}

// ---- 3. Fixed debug keystore (SHA-1 hamesha wahi, Firebase me registered) ----
let gradle = fs.readFileSync(gradlePath, "utf8");
if (!gradle.includes("pryielle-signing")) {
  gradle = gradle.replace(
    /\bandroid\s*\{/,
    `android {
    // pryielle-signing
    signingConfigs {
        debug {
            storeFile rootProject.file("../android-keystore/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`,
  );
}
// versionCode package.json ke version ke saath badhta hai (update install ke liye zaroori)
const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const [maj = 0, min = 0, pat = 0] = String(pkgJson.version).split(".").map((n) => Number.parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkgJson.version}"`);
fs.writeFileSync(gradlePath, gradle);

// ---- 4. Manifest: permissions + FileProvider ----
let m = fs.readFileSync(manifestPath, "utf8");
const perms = ["INTERNET", "ACCESS_NETWORK_STATE", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "CAMERA", "VIBRATE", "REQUEST_INSTALL_PACKAGES"];
for (const p of perms) {
  if (!m.includes(`android.permission.${p}"`)) m = m.replace("<application", `<uses-permission android:name="android.permission.${p}" />\n    <application`);
}
if (!m.includes("android.hardware.camera")) {
  m = m.replace("<application", `<uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n    <application`);
}
if (!m.includes("windowSoftInputMode")) m = m.replace("<activity", '<activity android:windowSoftInputMode="adjustResize"');
if (!/fileprovider/i.test(m)) {
  m = m.replace(
    "</application>",
    `    <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
        </provider>
    </application>`,
  );
}
fs.writeFileSync(manifestPath, m);

// FileProvider paths: Updater APK cache/updates/ me rakhta hai, wo cache-path se cover hota hai
fs.mkdirSync(`${res}/xml`, { recursive: true });
fs.writeFileSync(
  `${res}/xml/file_paths.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    <external-path name="my_images" path="." />\n    <cache-path name="updates" path="updates/" />\n    <cache-path name="my_cache_images" path="." />\n</paths>\n`,
);

// ---- 5. Native Java: UpdaterPlugin + MainActivity (plugin register) ----
const pkgDir = `${app}/src/main/java/${PKG.replaceAll(".", "/")}`;
fs.mkdirSync(pkgDir, { recursive: true });
for (const f of fs.readdirSync("native")) if (f.endsWith(".java")) fs.copyFileSync(`native/${f}`, `${pkgDir}/${f}`);
const mainActivity = fs.readFileSync(`${pkgDir}/MainActivity.java`, "utf8");
if (!mainActivity.includes("registerPlugin(UpdaterPlugin.class)")) throw new Error("MainActivity me UpdaterPlugin register nahi hua");

// ---- 6. Icons + splash ----
for (const dir of fs.readdirSync("resources/icons")) {
  const src = path.join("resources/icons", dir);
  if (!fs.statSync(src).isDirectory()) continue;
  fs.mkdirSync(path.join(res, dir), { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(res, dir, f));
}
fs.mkdirSync(`${res}/values`, { recursive: true });
fs.writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#141414</color>\n</resources>\n`);
let splashCount = 0;
for (const d of fs.readdirSync(res)) {
  const f = path.join(res, d, "splash.png");
  if (d.startsWith("drawable") && fs.existsSync(f)) {
    fs.copyFileSync("resources/splash.png", f);
    splashCount += 1;
  }
}
console.log(`✅ Android patched: ${PKG} v${pkgJson.version} (versionCode ${versionCode}), permissions + FileProvider + Updater plugin + ${splashCount} splash files`);
