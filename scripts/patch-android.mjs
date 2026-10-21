// Run after `npx cap add android`: permissions, Firebase file, icons, colours.
import fs from "node:fs";
import path from "node:path";

const app = "android/app";
fs.copyFileSync("config/google-services.json", `${app}/google-services.json`);


// Google Sign-In lib is optional in @capacitor-firebase/authentication v6; without this the app crashes on launch (NoClassDefFoundError GoogleSignIn).
const vars = "android/variables.gradle";
let v = fs.readFileSync(vars, "utf8");
if (!v.includes("rgcfaIncludeGoogle")) v = v.replace(/ext\s*\{/, "ext {\n    rgcfaIncludeGoogle = true");
fs.writeFileSync(vars, v);

// Force the fixed debug keystore so the APK SHA-1 always matches the one registered in Firebase (else Google login gives error 10).
const gradlePath = `${app}/build.gradle`;
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
  fs.writeFileSync(gradlePath, gradle);
}

const manifestPath = `${app}/src/main/AndroidManifest.xml`;
let manifest = fs.readFileSync(manifestPath, "utf8");
const perms = ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "POST_NOTIFICATIONS", "VIBRATE"];
for (const p of perms) {
  if (!manifest.includes(`android.permission.${p}`)) {
    manifest = manifest.replace("<application", `<uses-permission android:name="android.permission.${p}" />\n    <application`);
  }
}
if (!manifest.includes("resizeableActivity")) {
  manifest = manifest.replace("<activity", '<activity android:resizeableActivity="true"');
}
if (!manifest.includes("windowSoftInputMode")) {
  manifest = manifest.replace("<activity", '<activity android:windowSoftInputMode="adjustResize"');
}
fs.writeFileSync(manifestPath, manifest);

const res = `${app}/src/main/res`;
for (const dir of fs.readdirSync("resources/icons")) {
  const src = path.join("resources/icons", dir);
  if (!fs.statSync(src).isDirectory()) continue;
  fs.mkdirSync(path.join(res, dir), { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(res, dir, f));
}
const bg = `${res}/values/ic_launcher_background.xml`;
fs.mkdirSync(path.dirname(bg), { recursive: true });
fs.writeFileSync(bg, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#07060D</color>\n</resources>\n`);
console.log("✅ Android project patched");

// ---- floating window over other apps (native Java plugin + overlay service) ----
const pkgDir = `${app}/src/main/java/com/pryielle/msg`;
fs.mkdirSync(pkgDir, { recursive: true });
for (const f of fs.readdirSync("native")) if (f.endsWith(".java")) fs.copyFileSync(`native/${f}`, `${pkgDir}/${f}`);
let m2 = fs.readFileSync(manifestPath, "utf8");
for (const p of ["SYSTEM_ALERT_WINDOW", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_SPECIAL_USE"]) {
  if (!m2.includes(`android.permission.${p}`)) m2 = m2.replace("<application", `<uses-permission android:name="android.permission.${p}" />\n    <application`);
}
if (!m2.includes("FloatingService")) {
  m2 = m2.replace(
    "</application>",
    `    <service android:name=".FloatingService" android:exported="false" android:foregroundServiceType="specialUse">\n            <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="floating_chat_window" />\n        </service>\n    </application>`,
  );
}
fs.writeFileSync(manifestPath, m2);
console.log("✅ Floating window native code added");

// ---- v2.3: in-app updater + VPN check + versionCode that grows with package.json version ----
let m3 = fs.readFileSync(manifestPath, "utf8");
for (const p of ["ACCESS_NETWORK_STATE", "REQUEST_INSTALL_PACKAGES", "INTERNET"]) {
  if (!m3.includes(`android.permission.${p}"`)) m3 = m3.replace("<application", `<uses-permission android:name="android.permission.${p}" />\n    <application`);
}
// FileProvider (Capacitor's template normally has one already; add ours only if missing)
if (!/fileprovider/i.test(m3)) {
  m3 = m3.replace(
    "</application>",
    `    <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true">\n            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />\n        </provider>\n    </application>`,
  );
}
fs.writeFileSync(manifestPath, m3);
const xmlDir = `${res}/xml`;
fs.mkdirSync(xmlDir, { recursive: true });
const fpXml = `${xmlDir}/file_paths.xml`;
const fpText = fs.existsSync(fpXml) ? fs.readFileSync(fpXml, "utf8") : "";
if (!/cache-path/.test(fpText)) {
  fs.writeFileSync(fpXml, `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    <external-path name="my_images" path="." />\n    <cache-path name="my_cache_images" path="." />\n</paths>\n`);
}
const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const [maj = 0, min = 0, pat = 0] = String(pkgJson.version).split(".").map((n) => Number.parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;
let g2 = fs.readFileSync(gradlePath, "utf8");
g2 = g2.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkgJson.version}"`);
fs.writeFileSync(gradlePath, g2);
console.log(`✅ Updater + security native code added (versionCode ${versionCode})`);

// ---- v2.7: Emergency alarm (foreground service + FCM data push + sound from src/assets/sfx/hosh.mp3) ----
let m4 = fs.readFileSync(manifestPath, "utf8");
if (!m4.includes("xmlns:tools")) m4 = m4.replace("<manifest ", '<manifest xmlns:tools="http://schemas.android.com/tools" ');
for (const p of ["FOREGROUND_SERVICE_MEDIA_PLAYBACK", "WAKE_LOCK"]) {
  if (!m4.includes(`android.permission.${p}"`)) m4 = m4.replace("<application", `<uses-permission android:name="android.permission.${p}" />\n    <application`);
}
if (!m4.includes("AlarmService")) {
  m4 = m4.replace(
    "</application>",
    `    <service android:name=".AlarmService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />
        <service android:name=".AlarmMessagingService" android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>`,
  );
}
fs.writeFileSync(manifestPath, m4);
fs.mkdirSync(`${res}/raw`, { recursive: true });
fs.copyFileSync("src/assets/sfx/hosh.mp3", `${res}/raw/hosh_alarm.mp3`);
console.log("✅ Alarm native code added");

// ---- FIX: AlarmMessagingService needs firebase-messaging on the APP module's compile classpath ----
// capacitor-push-notifications declares it as `implementation`, so it is NOT visible to :app (error: cannot find symbol RemoteMessage / cannot access FirebaseMessagingService).
{
  let g3 = fs.readFileSync(gradlePath, "utf8");
  if (!g3.includes("firebase-messaging")) {
    const dep = `    // pryielle-fcm: needed by AlarmMessagingService (RemoteMessage / FirebaseMessagingService)\n    implementation "com.google.firebase:firebase-messaging:23.3.1"\n`;
    if (/^dependencies\s*\{/m.test(g3)) {
      g3 = g3.replace(/^dependencies\s*\{\s*\n/m, (m) => m + dep);
    } else {
      g3 += `\ndependencies {\n${dep}}\n`;
    }
    fs.writeFileSync(gradlePath, g3);
  }
  console.log("✅ firebase-messaging added to app/build.gradle");
}
