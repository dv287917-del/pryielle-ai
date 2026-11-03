// Pryielle MSG wale SAME Firebase project ka config banata hai (koi naya Firebase nahi).
// config/google-services.json = MSG app wali hi file. Agar usme com.pryielle.ai ka client ho to wo use hota hai,
// warna MSG wala client (Firestore/Auth dono ke liye chalta hai).
import fs from "node:fs";

const file = "config/google-services.json";
if (!fs.existsSync(file)) {
  console.error("\n❌ config/google-services.json nahi mili (MSG app wali file yahan daalo).\n");
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const pkgOf = (c) => c.client_info?.android_client_info?.package_name;
const client = j.client.find((c) => pkgOf(c) === "com.pryielle.ai") ?? j.client.find((c) => pkgOf(c) === "com.pryielle.msg") ?? j.client[0];
const cfg = {
  apiKey: client.api_key[0].current_key,
  authDomain: `${j.project_info.project_id}.firebaseapp.com`,
  projectId: j.project_info.project_id,
  storageBucket: j.project_info.storage_bucket,
  messagingSenderId: j.project_info.project_number,
  appId: client.client_info.mobilesdk_app_id,
};
fs.writeFileSync("src/firebase-config.generated.ts", `export const firebaseConfig = ${JSON.stringify(cfg, null, 2)};\n`);
console.log("✅ Firebase config ready (shared project):", cfg.projectId);
