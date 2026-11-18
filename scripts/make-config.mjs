// Builds src/firebase-config.generated.ts from config/google-services.json
import fs from "node:fs";

const file = "config/google-services.json";
if (!fs.existsSync(file)) {
  console.error("\n❌ config/google-services.json nahi mili. SETUP.md ka Step 3 dekho.\n");
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const client = j.client.find((c) => c.client_info?.android_client_info?.package_name === "com.pryielle.msg") ?? j.client[0];
const cfg = {
  apiKey: client.api_key[0].current_key,
  authDomain: `${j.project_info.project_id}.firebaseapp.com`,
  projectId: j.project_info.project_id,
  storageBucket: j.project_info.storage_bucket,
  messagingSenderId: j.project_info.project_number,
  appId: client.client_info.mobilesdk_app_id,
};
fs.writeFileSync(
  "src/firebase-config.generated.ts",
  `export const firebaseConfig = ${JSON.stringify(cfg, null, 2)};\n`,
);
console.log("✅ Firebase config ready for project", cfg.projectId);
