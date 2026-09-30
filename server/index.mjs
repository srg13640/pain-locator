import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PAIN_LOCATOR_PORT || 4721);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const DATA_DIR = path.resolve(process.env.PAIN_LOCATOR_DIR || path.join(os.homedir(), "PainLocator"));
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const ENTRIES_PATH = path.join(DATA_DIR, "entries.json");
const README_PATH = path.join(DATA_DIR, "README.txt");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function localHost(header) {
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(header || "");
}

async function ensureDataDir() {
  await mkdir(EXPORT_DIR, { recursive: true });
  try {
    await stat(ENTRIES_PATH);
  } catch {
    await writeFile(ENTRIES_PATH, "[]\n");
  }
  await writeFile(
    README_PATH,
    [
      "This folder is your Pain Locator data.",
      "entries.json holds every pain note.",
      "exports/ holds PDF copies.",
      "Copy this whole folder to back the notes up.",
      "Delete this whole folder to erase them.",
      "The app does not send this folder anywhere.",
      "",
    ].join("\n"),
  );
}

async function readEntries() {
  const raw = await readFile(ENTRIES_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeEntries(entries) {
  await writeFile(ENTRIES_PATH, JSON.stringify(entries, null, 2));
}

function readBody(req, limit = 20_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function entryFromBody(body, existing) {
  const now = new Date().toISOString();
  const severity = Number(body.severity);
  return {
    id: existing?.id || (typeof body.id === "string" ? body.id : randomUUID()),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    position: body.position,
    structure: body.structure,
    beneath: Array.isArray(body.beneath) ? body.beneath : [],
    quality: body.quality ?? null,
    severity: Number.isFinite(severity) ? Math.min(10, Math.max(0, severity)) : 0,
    radiation: body.radiation ?? null,
    triggers: Array.isArray(body.triggers) ? body.triggers : [],
    onset: typeof body.onset === "string" ? body.onset : "",
    duration: typeof body.duration === "string" ? body.duration : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    ...(body.body === "woman" || body.body === "man" ? { body: body.body } : existing?.body ? { body: existing.body } : {}),
  };
}

function validEntry(entry) {
  return (
    Array.isArray(entry.position) &&
    entry.position.length === 3 &&
    entry.structure &&
    typeof entry.structure.medicalName === "string"
  );
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/info" && req.method === "GET") {
    sendJson(res, 200, { dataDir: DATA_DIR, exportDir: EXPORT_DIR });
    return;
  }
  if (url.pathname === "/api/entries" && req.method === "GET") {
    sendJson(res, 200, await readEntries());
    return;
  }
  if (url.pathname === "/api/entries" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const entry = entryFromBody(body, null);
    if (!validEntry(entry)) {
      sendJson(res, 400, { error: "That note is missing a location." });
      return;
    }
    const entries = await readEntries();
    entries.push(entry);
    await writeEntries(entries);
    sendJson(res, 201, entry);
    return;
  }
  const match = url.pathname.match(/^\/api\/entries\/([^/]+)$/);
  if (match && req.method === "PUT") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const entries = await readEntries();
    const index = entries.findIndex((item) => item.id === decodeURIComponent(match[1]));
    if (index < 0) {
      sendJson(res, 404, { error: "That note was not found." });
      return;
    }
    const entry = entryFromBody(body, entries[index]);
    if (!validEntry(entry)) {
      sendJson(res, 400, { error: "That note is missing a location." });
      return;
    }
    entries[index] = entry;
    await writeEntries(entries);
    sendJson(res, 200, entry);
    return;
  }
  if (match && req.method === "DELETE") {
    const entries = await readEntries();
    const next = entries.filter((item) => item.id !== decodeURIComponent(match[1]));
    await writeEntries(next);
    sendJson(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/api/exports" && req.method === "POST") {
    const bytes = await readBody(req);
    const rawName = String(req.headers["x-filename"] || "pain-record.pdf");
    const filename = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, "") || "pain-record.pdf";
    const target = path.join(EXPORT_DIR, filename);
    await writeFile(target, bytes);
    sendJson(res, 201, { path: target });
    return;
  }
  sendJson(res, 404, { error: "Not found" });
}

function filePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) return null;
  return resolved;
}

async function handleFile(res, urlPath) {
  const target = filePath(urlPath);
  if (!target) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end("Forbidden");
    return;
  }
  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("missing");
    const type = TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": type });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, SECURITY_HEADERS);
    res.end("Not found");
  }
}

await ensureDataDir();

const server = createServer((req, res) => {
  if (!localHost(req.headers.host)) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end("This app only answers on this computer.");
    return;
  }
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error) => {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Something went wrong." });
    });
    return;
  }
  void handleFile(res, url.pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Pain Locator is running at http://127.0.0.1:${PORT}/`);
  console.log(`Your notes are stored in ${DATA_DIR}`);
});
