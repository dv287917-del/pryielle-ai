import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const manifestPath = join(root, "android/app/src/main/AndroidManifest.xml");
let manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes("usesCleartextTraffic")) {
  manifest = manifest.replace("<application", '<application android:usesCleartextTraffic="true"');
}
if (!manifest.includes("android.permission.INTERNET")) {
  manifest = manifest.replace("</manifest>", '    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>');
}
writeFileSync(manifestPath, manifest);
console.log("Android manifest patched.");
