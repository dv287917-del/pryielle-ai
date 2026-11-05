// Secret code badalna ho to: node scripts/make-secret.mjs "naya code"
// Output ke salt + codeHash Firestore `aiAdmin/builder` me daalo. Code khud kahin save mat karo.
import { createHash, randomBytes } from "node:crypto";
const code = process.argv.slice(2).join(" ").trim();
if (!code) { console.error('Use: node scripts/make-secret.mjs "tumhara code"'); process.exit(1); }
if (code.length > 100) { console.error("Code 100 character se chhota rakho (server itna hi check karta hai)."); process.exit(1); }
const salt = randomBytes(12).toString("hex");
console.log(JSON.stringify({ salt, codeHash: createHash("sha256").update(`${salt}:${code}`).digest("hex") }, null, 2));
