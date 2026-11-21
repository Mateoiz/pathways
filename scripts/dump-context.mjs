// scripts/dump-context.mjs
// Usage:  node scripts/dump-context.mjs
// Output: system-context.md  (paste its contents into the chat)
//
// Needs:  npm i -D firebase-admin
// Auth:   Firebase console > Project settings > Service accounts > Generate new private key
//         Save as ./serviceAccountKey.json (add it to .gitignore, never commit it)
//         or set GOOGLE_APPLICATION_CREDENTIALS to its path.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";
const SAMPLE_SIZE = 50; // docs scanned per collection to infer the schema
const EXAMPLES = 2; // redacted example docs shown per collection
const MAX_DEPTH = 2; // how deep to follow subcollections
const SRC_DIRS = ["app", "components", "lib", "src", "hooks", "types"];
const SENSITIVE = /name|email|phone|address|birth|password|contact|guardian|parent|mobile|reference|ref(no)?$|token|secret/i;

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(KEY_PATH, "utf8"))) });
const db = getFirestore();

/* ───────── helpers ───────── */

function typeOf(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v?.toDate === "function") return "timestamp";
  if (v?._path) return "reference";
  return typeof v;
}

// Flatten a doc into { "a.b.c": value } (arrays become "a[]")
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const t = typeOf(v);
    if (t === "object") flatten(v, p, out);
    else if (t === "array") {
      out[`${p}[]`] = v[0];
      if (typeOf(v[0]) === "object") flatten(v[0], `${p}[]`, out);
    } else out[p] = v;
  }
  return out;
}

function redact(v, key = "") {
  const t = typeOf(v);
  if (SENSITIVE.test(key)) return "<redacted>";
  if (t === "string") return v.length > 30 ? v.slice(0, 30) + "…" : v;
  if (t === "timestamp") return "<timestamp>";
  if (t === "reference") return "<reference>";
  if (t === "array") return v.slice(0, 2).map((x) => redact(x, key));
  if (t === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x, k)]));
  return v;
}

/* ───────── firestore ───────── */

async function describeCollection(colRef, depth, lines) {
  const indent = "  ".repeat(depth);
  const snap = await colRef.limit(SAMPLE_SIZE).get();
  let total = "?";
  try {
    total = (await colRef.count().get()).data().count;
  } catch {}

  lines.push(`${indent}### ${colRef.path}  (${total} docs, scanned ${snap.size})`);
  if (snap.empty) return lines.push("");

  const fields = new Map(); // path -> { types:Set, values:Set, seen:number }
  snap.docs.forEach((d) => {
    const flat = flatten(d.data());
    for (const [p, v] of Object.entries(flat)) {
      const f = fields.get(p) || { types: new Set(), values: new Set(), seen: 0 };
      f.types.add(typeOf(v));
      f.seen++;
      if (typeof v === "string" && !SENSITIVE.test(p) && f.values.size <= 8) f.values.add(v);
      fields.set(p, f);
    }
  });

  lines.push(`${indent}Fields (present in x of ${snap.size} docs):`);
  for (const [p, f] of [...fields].sort()) {
    const enumHint = f.values.size > 0 && f.values.size <= 8 && f.types.has("string") ? `  values: ${[...f.values].join(" | ")}` : "";
    lines.push(`${indent}- ${p}: ${[...f.types].join("|")}  (${f.seen})${enumHint}`);
  }

  lines.push(`${indent}Example docs (redacted):`);
  snap.docs.slice(0, EXAMPLES).forEach((d) => {
    lines.push(`${indent}\`\`\`json`);
    lines.push(JSON.stringify({ _id: d.id.length > 12 ? d.id.slice(0, 6) + "…" : d.id, ...redact(d.data()) }, null, 2));
    lines.push(`${indent}\`\`\``);
  });

  if (depth < MAX_DEPTH) {
    const subNames = new Set();
    for (const d of snap.docs.slice(0, 5)) (await d.ref.listCollections()).forEach((c) => subNames.add(c.id));
    for (const name of subNames) await describeCollection(snap.docs[0].ref.collection(name), depth + 1, lines);
  }
  lines.push("");
}

/* ───────── project files ───────── */

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, files) : /\.(tsx?|jsx?|mjs)$/.test(e.name) && files.push(p);
  }
  return files;
}

function collectionUsage(files) {
  const usage = new Map(); // collection -> Set(files)
  const re = /(?:collection|doc)\(\s*db\s*,\s*["'`]([^"'`]+)["'`]/g;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(re)) {
      if (!usage.has(m[1])) usage.set(m[1], new Set());
      usage.get(m[1]).add(f.replaceAll("\\", "/"));
    }
  }
  return usage;
}

/* ───────── main ───────── */

const out = ["# System context", "", `Generated ${new Date().toISOString()}`, ""];

// 1. Project structure
const files = SRC_DIRS.flatMap((d) => walk(d)).sort();
out.push("## Source files", "", ...files.map((f) => `- ${f.replaceAll("\\", "/")}`), "");

// 2. Which files touch which collections
out.push("## Collections used in code", "");
for (const [col, set] of [...collectionUsage(files)].sort()) out.push(`- **${col}**: ${[...set].join(", ")}`);
out.push("");

// 3. Live Firestore schema
out.push("## Firestore schema (from live data)", "");
for (const col of await db.listCollections()) await describeCollection(col, 0, out);

// 4. Rules + config files worth reading
for (const f of ["firestore.rules", "lib/academicConfig.ts", "src/lib/academicConfig.ts"]) {
  if (fs.existsSync(f)) out.push(`## ${f}`, "", "```", fs.readFileSync(f, "utf8"), "```", "");
}

fs.writeFileSync("system-context.md", out.join("\n"));
console.log(`Done. Wrote system-context.md (${out.length} lines). Review it for personal data before sharing.`);
process.exit(0);
