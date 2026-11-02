// Maps Supabase-style /rest/v1/* requests onto a bare PostgREST server. Local development only.
import http from "node:http";

const target = new URL(process.env.TARGET ?? "http://127.0.0.1:55623");
const port = Number(process.env.PORT ?? 8000);
const PREFIX = "/rest/v1";

http
  .createServer((req, res) => {
    if (!req.url?.startsWith(PREFIX)) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "localnet gateway only proxies /rest/v1" }));
      return;
    }
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: req.url.slice(PREFIX.length) || "/",
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "postgrest unavailable" }));
    });
    req.pipe(upstream);
  })
  .listen(port, "0.0.0.0", () => console.log(`[gateway] /rest/v1 -> ${target.origin} on :${port}`));
