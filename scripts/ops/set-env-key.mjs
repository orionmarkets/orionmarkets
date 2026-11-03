// Sets KEY='value' in an env file: replaces the existing line or appends one. The value stays literal (single quotes),
// so it may not contain a single quote or a newline.
//   node scripts/ops/set-env-key.mjs <file> <KEY> <value>
import { readFileSync, writeFileSync } from "node:fs";

const [file, key, value] = process.argv.slice(2);
if (!file || !/^[A-Z][A-Z0-9_]*$/.test(key ?? "") || value === undefined) throw Error("usage: set-env-key.mjs <file> <KEY> <value>");
if (/['\n]/.test(value)) throw Error(`value of ${key} contains a quote or newline`);
const line = `${key}='${value}'`;
const re = new RegExp(`^${key}=.*$`, "m");
const s = readFileSync(file, "utf8");
writeFileSync(file, re.test(s) ? s.replace(re, () => line) : `${s.replace(/\n?$/, "\n")}${line}\n`);
console.log(`set ${key}`);
