import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

function vitePluginTalkTakProxy(): Plugin {
  return {
    name: "manus-talktak-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/talktak/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "server_not_configured" }));
          return;
        }

        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk.toString();
          if (raw.length > 256 * 1024) {
            req.destroy();
          }
        });
        req.on("end", async () => {
          let body: any = {};
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid_json" }));
            return;
          }
          if (!Array.isArray(body.messages) || body.messages.length === 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "messages_required" }));
            return;
          }
          const safeMessages = body.messages.slice(-20).map((m: any) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content.slice(0, 8000) : "",
          }));
          try {
            const upstream = await fetch(`${forgeBaseUrl}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${forgeKey}`,
              },
              body: JSON.stringify({
                model: body.model || "gpt-4.1-mini",
                temperature:
                  typeof body.temperature === "number" ? body.temperature : 0.5,
                max_tokens:
                  typeof body.max_tokens === "number"
                    ? Math.min(body.max_tokens, 600)
                    : 360,
                messages: safeMessages,
              }),
            });
            if (!upstream.ok) {
              let detail: unknown = await upstream.text().catch(() => "");
              try {
                detail = JSON.parse(detail as string);
              } catch {
                /* keep raw */
              }
              res.writeHead(upstream.status, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "upstream_error", detail }));
              return;
            }
            const data = (await upstream.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
            if (!reply) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "empty_reply" }));
              return;
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ reply }));
          } catch (e) {
            const detail = e instanceof Error ? e.message : "unknown";
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "fetch_failed", detail }));
          }
        });
      });
    },
  };
}

// v3.7+: dev-time mirror of the same Express proxy in server/index.ts so the
// PWA can hit /api/feed, /api/analyze, /api/r/:id from the Vite dev server.
function vitePluginNewsBackendProxy(): Plugin {
  const NEWS_BACKEND = (process.env.NEWS_BACKEND_URL || "").replace(/\/+$/, "");
  
  // If no backend URL is configured, disable this plugin entirely
  // Express server will handle all /api routes
  if (!NEWS_BACKEND) {
    return {
      name: "vite-plugin-news-backend-proxy-disabled",
    };
  }

  async function readBody(req: any): Promise<string> {
    return await new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (chunk: Buffer) => {
        raw += chunk.toString();
        if (raw.length > 256 * 1024) {
          req.destroy();
          reject(new Error("body_too_large"));
        }
      });
      req.on("end", () => resolve(raw));
      req.on("error", reject);
    });
  }

  async function pipeUpstream(
    res: any,
    upstreamPath: string,
    init: { method: "GET" | "POST"; body?: string; timeoutMs: number },
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs);
    try {
      const upstream = await fetch(`${NEWS_BACKEND}${upstreamPath}`, {
        method: init.method,
        headers: init.body
          ? { "Content-Type": "application/json" }
          : undefined,
        body: init.body,
        signal: controller.signal,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
      });
      res.end(text);
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      const detail = e instanceof Error ? e.message : "unknown";
      res.writeHead(aborted ? 504 : 502, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          error: aborted ? "upstream_timeout" : "upstream_unreachable",
          detail,
        }),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "manus-news-backend-proxy",
    configureServer(server: ViteDevServer) {
      // GET /api/feed?limit=NN
      server.middlewares.use("/api/feed", async (req, res, next) => {
        // Pass through /api/feed/refresh to the next handler (POST below).
        if (req.url && req.url.startsWith("/refresh")) {
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "method_not_allowed" }));
            return;
          }
          await pipeUpstream(res, "/feed/refresh", {
            method: "POST",
            timeoutMs: 30_000,
          });
          return;
        }
        if (req.method !== "GET") {
          next();
          return;
        }
        const url = new URL(
          req.url || "/",
          "http://localhost",
        );
        const limitRaw = url.searchParams.get("limit") || "30";
        const limit = Math.max(
          1,
          Math.min(100, parseInt(limitRaw, 10) || 30),
        );
        await pipeUpstream(res, `/feed?limit=${limit}`, {
          method: "GET",
          timeoutMs: 15_000,
        });
      });

      // POST /api/analyze
      server.middlewares.use("/api/analyze", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        let raw = "";
        try {
          raw = await readBody(req);
        } catch {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "body_too_large" }));
          return;
        }
        await pipeUpstream(res, "/analyze", {
          method: "POST",
          body: raw || "{}",
          timeoutMs: 90_000,
        });
      });

      // GET /api/r/:shareId
      server.middlewares.use("/api/r/", async (req, res) => {
        if (req.method !== "GET") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        const id = (req.url || "/").replace(/^\/+/, "").split("?")[0];
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "share_id_required" }));
          return;
        }
        await pipeUpstream(res, `/r/${encodeURIComponent(id)}`, {
          method: "GET",
          timeoutMs: 15_000,
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, { Location: url, "Cache-Control": "no-store" });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector(), vitePluginStorageProxy(), vitePluginTalkTakProxy(), vitePluginNewsBackendProxy()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
