import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import mysql, { type PoolOptions } from "mysql2/promise";
import { startRSSScheduler, triggerRSSFetch } from "./rss-scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORGE_BASE = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY || "";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function invokeLLM(messages: ChatMessage[]): Promise<string> {
  if (!FORGE_BASE || !FORGE_KEY) {
    throw new Error("LLM not configured: BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY missing");
  }

  const response = await fetch(`${FORGE_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_KEY}`,
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      temperature: 0.3,
      max_tokens: 2000,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Empty LLM response");
  return content;
}

async function analyzeArticle(text: string): Promise<any> {
  const systemPrompt = `당신은 뉴스 기사의 신뢰도를 평가하는 AI 분석 전문가입니다.
다음 10개 항목을 JSON 형식으로 평가하세요:
1. overall: 종합 신뢰도 (0-100)
2. source_credibility: 출처 신뢰도 (0-100)
3. headline_body_match: 제목과 본문 일치도 (0-100)
4. emotional_language: 감정적 표현/선동성 (0-100, 낮을수록 좋음)
5. fact_opinion_distinction: 사실 주장과 의견 구분 (0-100)
6. evidence_presence: 근거/인용/수치 존재 여부 (0-100)
7. exaggeration_absoluteness: 과장/단정 표현 (0-100, 낮을수록 좋음)
8. political_commercial_bias: 정치적·상업적 편향 가능성 (0-100, 낮을수록 좋음)
9. logical_fallacy: 논리적 비약 여부 (0-100, 낮을수록 좋음)
10. final_judgment: 최종 판단 (0-100)

또한 다음을 제공하세요:
- summary: 한 줄 요약
- risk_signals: 위험 신호 3개 (배열)
- reliable_elements: 신뢰 가능한 요소 3개 (배열)
- recommendations: 추가 검증 건의
- trust_grade: 최종 신뢰도 등급 (A+, A, B+, B, C+, C, D+, D, F)

JSON만 반환하세요.`;

  try {
    const response = await invokeLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: `다음 기사를 분석해주세요:\n\n${text}` },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || "",
      scores: {
        overall: parsed.overall ?? 0,
        source_credibility: parsed.source_credibility ?? 0,
        headline_body_match: parsed.headline_body_match ?? 0,
        emotional_language: parsed.emotional_language ?? 0,
        fact_opinion_distinction: parsed.fact_opinion_distinction ?? 0,
        evidence_presence: parsed.evidence_presence ?? 0,
        exaggeration_absoluteness: parsed.exaggeration_absoluteness ?? 0,
        political_commercial_bias: parsed.political_commercial_bias ?? 0,
        logical_fallacy: parsed.logical_fallacy ?? 0,
        final_judgment: parsed.final_judgment ?? 0,
      },
      risk_signals: parsed.risk_signals || [],
      reliable_elements: parsed.reliable_elements || [],
      recommendations: parsed.recommendations || "",
      trust_grade: parsed.trust_grade || "F",
    };
  } catch (err) {
    console.error("[analyzeArticle] Error:", err);
    throw err;
  }
}

let dbPool: mysql.Pool | null = null;

async function getDBPool() {
  if (!dbPool) {
    const dbUrl = process.env.DATABASE_URL || "";
    try {
      const url = new URL(dbUrl);
      dbPool = mysql.createPool({
        host: url.hostname,
        user: url.username,
        password: url.password,
        database: url.pathname.split("/")[1],
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
      console.log("[DB] Connection pool created");
    } catch (err) {
      console.error("[DB] Failed to create pool:", err);
      throw err;
    }
  }
  return dbPool;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "256kb" }));

  // Initialize database and RSS scheduler
  try {
    const pool = await getDBPool();
    console.log("[DB] Connected to database");
    startRSSScheduler();
  } catch (err) {
    console.error("[DB] Connection failed:", err);
  }

  // Serve static files (Vite build output)
  const distPath = path.join(__dirname, "../dist/client");
  app.use(express.static(distPath));

  // ── News analysis ────────────────────────────────────────────────────────
  // GET /api/feed?limit=NN  →  Fetch latest articles from database
  app.get("/api/feed", async (req, res) => {
    try {
      const limitRaw = String(req.query.limit ?? "30");
      const limit = Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 30));

      const pool = await getDBPool();
      const conn = await pool.getConnection();

      const [rows] = (await conn.query(
        `SELECT a.id, a.title, a.description, a.link, a.pub_date, a.fetched_at,
                s.name as source, s.color
         FROM articles a
         JOIN rss_sources s ON a.source_id = s.id
         ORDER BY a.pub_date DESC
         LIMIT ?`,
        [limit],
      )) as any[];

      await conn.release();

      res.json({
        items: rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          link: row.link,
          source: row.source,
          color: row.color,
          pubDate: row.pub_date,
          fetchedAt: row.fetched_at,
        })),
      });
    } catch (err) {
      console.error("[/api/feed] Error:", err);
      res.status(500).json({ error: "feed_fetch_failed" });
    }
  });

  // POST /api/feed/refresh  →  Trigger manual RSS fetch
  app.post("/api/feed/refresh", async (_req, res) => {
    try {
      await triggerRSSFetch();
      res.json({ refreshed: true });
    } catch (err) {
      console.error("[/api/feed/refresh] Error:", err);
      res.status(500).json({ error: "refresh_failed" });
    }
  });

  // POST /api/analyze  →  Internal 9-agent analysis pipeline
  app.post("/api/analyze", async (req, res) => {
    const { text, url } = req.body || {};

    if (!text && !url) {
      res.status(400).json({ error: "text or url required" });
      return;
    }

    try {
      let articleText = text;

      if (url && !text) {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10_000),
          });
          if (response.ok) {
            const html = await response.text();
            const textMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (textMatch) {
              articleText = textMatch[1]
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 5000);
            }
          }
        } catch {
          articleText = `URL: ${url}\n본문을 붙여넣기 모드로 분석해주세요.`;
        }
      }

      if (!articleText || articleText.length < 20) {
        res.status(400).json({ error: "text too short" });
        return;
      }

      const result = await analyzeArticle(articleText);
      res.json(result);
    } catch (err) {
      console.error("[/api/analyze] Error:", err);
      res.status(500).json({ error: "analysis_failed" });
    }
  });

  // GET /api/r/:shareId  →  Placeholder for shared results
  app.get("/api/r/:shareId", async (req, res) => {
    res.json({ result: null });
  });

  // SPA fallback
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`[Server] Running on http://localhost:${port}/`);
    console.log(`[Analysis Engine] ${FORGE_BASE && FORGE_KEY ? "ENABLED" : "DISABLED"}`);
    console.log(`[RSS Scheduler] ENABLED`);
  });

  process.on("SIGTERM", async () => {
    console.log("[Server] SIGTERM received, shutting down...");
    if (dbPool) {
      await dbPool.end();
    }
    process.exit(0);
  });
}

startServer().catch(console.error);
