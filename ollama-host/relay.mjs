// HomeCal – Ollama relay (runs on the PC that hosts Ollama).
//
// Exposed to the internet through Tailscale Funnel, it only forwards
//   POST /api/chat  and  GET /api/tags
// to the local Ollama, and only with the shared secret:
//   Authorization: Bearer <HOMECAL_RELAY_TOKEN>
//
// No dependencies: node relay.mjs   (Node >= 18)
// Config (env or ollama-host/relay.env):
//   HOMECAL_RELAY_TOKEN   shared secret (also set as OLLAMA_TUNNEL_TOKEN on Vercel)
//   HOMECAL_RELAY_PORT    default 11435
//   OLLAMA_URL            default http://127.0.0.1:11434

import { createServer } from "node:http";
import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "relay.env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line.replace(/^﻿/, ""));
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// Log to relay.log next to the script (the relay runs hidden at logon)
const logFile = join(here, "relay.log");
for (const level of ["log", "warn", "error"]) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    orig(...args);
    try {
      appendFileSync(logFile, `${args.join(" ")}\n`);
    } catch {
      /* ignore */
    }
  };
}

const TOKEN = process.env.HOMECAL_RELAY_TOKEN ?? "";
const PORT = Number(process.env.HOMECAL_RELAY_PORT ?? 11435);
const OLLAMA = (process.env.OLLAMA_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const MAX_BODY = 1_000_000; // 1 MB

if (TOKEN.length < 32) {
  console.error("HOMECAL_RELAY_TOKEN manquant ou trop court (32 caractères minimum).");
  process.exit(1);
}

const ROUTES = new Map([
  ["POST /api/chat", "/api/chat"],
  ["GET /api/tags", "/api/tags"],
  ["GET /health", null],
]);

function authorized(req) {
  const h = req.headers.authorization ?? "";
  const given = Buffer.from(h.startsWith("Bearer ") ? h.slice(7) : "");
  const expected = Buffer.from(TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const key = `${req.method} ${new URL(req.url ?? "/", "http://x").pathname}`;
  if (!ROUTES.has(key)) return send(res, 404, { error: "not found" });
  if (!authorized(req)) {
    console.warn(new Date().toISOString(), "refused", key, req.headers["x-forwarded-for"] ?? req.socket.remoteAddress);
    return send(res, 401, { error: "unauthorized" });
  }
  if (key === "GET /health") return send(res, 200, { ok: true });

  let body;
  if (req.method === "POST") {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) return send(res, 413, { error: "payload too large" });
      chunks.push(c);
    }
    body = Buffer.concat(chunks);
  }

  const started = Date.now();
  try {
    const upstream = await fetch(OLLAMA + ROUTES.get(key), {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(170_000),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(text);
    console.log(new Date().toISOString(), key, upstream.status, `${Date.now() - started} ms`);
  } catch (e) {
    console.error(new Date().toISOString(), key, "ollama error:", e.message);
    send(res, 502, { error: `Ollama injoignable: ${e.message}` });
  }
});

// Listen on loopback only: Tailscale Funnel connects locally.
server.listen(PORT, "127.0.0.1", () => console.log(`HomeCal relay → ${OLLAMA} on http://127.0.0.1:${PORT}`));
