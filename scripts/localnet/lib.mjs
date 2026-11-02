// Shared helpers for the localhost stack (Postgres + PostgREST in Docker, no cloud credentials).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const COMPOSE = process.env.ORION_COMPOSE || path.join(ROOT, "docker/localnet/compose.yml");
// Local defaults (throwaway, must match docker/localnet/compose.yml). The VPS sets ORION_JWT_SECRET and
// ORION_SUPABASE_URL to its own stack (docs/HOSTING.md).
export const JWT_SECRET = process.env.ORION_JWT_SECRET || "orion-local-jwt-secret-not-for-production-0123456789";
export const SUPABASE_URL = process.env.ORION_SUPABASE_URL || "http://127.0.0.1:55621";

const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

/** HS256 JWT in the shape supabase-js sends to PostgREST. */
export function signJwt(role) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ role, iss: "orion-localnet", iat: now, exp: now + 10 * 365 * 24 * 3600 });
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

export function compose(args, options = {}) {
  return run("docker", ["compose", "-f", COMPOSE, ...args], options);
}

export function psql(sql, { quiet = false } = {}) {
  const result = compose(
    ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "orion", ...(quiet ? ["-tA"] : [])],
    { input: sql },
  );
  if (result.status !== 0) throw new Error(`psql failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

/** Parse KEY=VALUE lines (no interpolation), preserving order. */
export function readEnvFile(file) {
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) rows.push([m[1], m[2]]);
  }
  return rows;
}
