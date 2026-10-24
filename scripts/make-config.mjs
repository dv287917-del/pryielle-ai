import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const gs = JSON.parse(readFileSync(join(root, "config", "google-services.json"), "utf8"));
const client = gs.client[0];
const config = {
  apiKey: client.api_key[0].current_key,
  authDomain: `${gs.project_info.project_id}.firebaseapp.com`,
  projectId: gs.project_info.project_id,
  storageBucket: gs.project_info.storage_bucket,
  messagingSenderId: gs.project_info.project_number,
  appId: client.client_info.mobilesdk_app_id,
};
writeFileSync(join(root, "src", "firebase-config.generated.ts"),
  `// AUTO-GENERATED\nexport const firebaseConfig = ${JSON.stringify(config, null, 2)};\n`);
console.log("Firebase config generated.");
