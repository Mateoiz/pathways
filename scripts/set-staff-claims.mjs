// scripts/set-staff-claims.mjs
// Usage: node scripts/set-staff-claims.mjs
//
// Reads the `users` collection and gives each admin/registrar a Firebase Auth custom claim
// { role: "admin" | "registrar" } so security rules can recognise staff.
// Run it again whenever you add or change a staff member. They must sign out and back in afterwards.
//
// Needs ./serviceAccountKey.json (or GOOGLE_APPLICATION_CREDENTIALS). Don't commit it.

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(KEY_PATH, "utf8"))) });

const auth = getAuth();
const db = getFirestore();

const snap = await db.collection("users").get();
let updated = 0;

for (const d of snap.docs) {
  const { email, role } = d.data();
  if (!email || !["admin", "registrar"].includes(role)) {
    console.log(`skip   ${d.id} (no email or not admin/registrar)`);
    continue;
  }
  try {
    const user = await auth.getUserByEmail(String(email).trim().toLowerCase());
    await auth.setCustomUserClaims(user.uid, { role });
    console.log(`ok     ${email} -> ${role}`);
    updated++;
  } catch (err) {
    console.log(`FAILED ${email}: ${err.code || err.message} (does this person have a Firebase Auth account?)`);
  }
}

console.log(`\nDone. ${updated} staff account(s) updated. Ask them to sign out and sign in again.`);
process.exit(0);
