// Brings up the localhost stack: Postgres + PostgREST (+ gateway) in Docker, schema, seed and env files.
//   pnpm localnet:up            start (idempotent)
//   pnpm localnet:up --reseed   reload supabase/seed.sql
//   pnpm localnet:up --force-env  rewrite the generated .env files
import fs from "node:fs";
import path from "node:path";
import { ROOT, compose, psql, run } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const log = (msg) => console.log(`[localnet] ${msg}`);

if (run("docker", ["info"]).status !== 0) {
  console.error("[localnet] Docker is not reachable. Start Docker (or Podman's docker socket) and retry.");
  process.exit(1);
}

// Postgres first: PostgREST logs in as the `authenticator` role, which the bootstrap below creates.
log("starting Postgres");
const dbUp = compose(["up", "-d", "--wait", "db"], { stdio: "inherit" });
if (dbUp.status !== 0) process.exit(dbUp.status ?? 1);

const fresh = psql("select to_regclass('public.markets') is null;", { quiet: true }).trim() === "t";
if (fresh) {
  log("fresh database: creating roles and applying migrations");
  psql(fs.readFileSync(path.join(ROOT, "supabase/local/00_roles.sql"), "utf8"));
  const dir = path.join(ROOT, "supabase/migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    log(`  migration ${file}`);
    psql(fs.readFileSync(path.join(dir, file), "utf8"));
  }
}
if (fresh || args.has("--reseed")) {
  log("loading local fixture (supabase/seed.sql)");
  psql(fs.readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
}
log("starting PostgREST and the /rest/v1 gateway");
const restUp = compose(["up", "-d", "--wait"], { stdio: "inherit" });
if (restUp.status !== 0) process.exit(restUp.status ?? 1);
psql("notify pgrst, 'reload schema';");

log("writing env files");
const env = run("node", [path.join(ROOT, "scripts/localnet/write-env.mjs"), ...(args.has("--force-env") ? ["--force"] : [])], {
  stdio: "inherit",
});
if (env.status !== 0) process.exit(env.status ?? 1);

log("ready. REST: http://127.0.0.1:55621/rest/v1  ·  Postgres: postgres://postgres:orion_local_only@127.0.0.1:55622/orion");
log("next: pnpm dev:core   (web on http://localhost:3002, API on http://localhost:3001)");
