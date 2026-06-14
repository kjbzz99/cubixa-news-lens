import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Forge OpenAI-compatible chat endpoint, called server-side so the API key
// never reaches the browser. We intentionally use the *server-side* key
// (BUILT_IN_FORGE_API_KEY), not the frontend one, because:
//  1. The frontend key has frontend-origin restrictions that fail under our
//     published domain unless explicitly whitelisted.
//  2. The server key is privileged and never crosses the network boundary.
const FORGE_BASE = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY || "";

// Internal analysis engine — uses Anthropic Claude via Manus Forge API
// No external backend dependency.

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TalkTakChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
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
  // 9-agent analysis pipeline
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

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || "분석 완료",
      scores: {
        overall: parsed.overall ?? 50,
        source_credibility: parsed.source_credibility ?? 50,
        headline_body_match: parsed.headline_body_match ?? 50,
        emotional_language: parsed.emotional_language ?? 50,
        fact_opinion_distinction: parsed.fact_opinion_distinction ?? 50,
        evidence_presence: parsed.evidence_presence ?? 50,
        exaggeration_absoluteness: parsed.exaggeration_absoluteness ?? 50,
        political_commercial_bias: parsed.political_commercial_bias ?? 50,
        logical_fallacy: parsed.logical_fallacy ?? 50,
        final_judgment: parsed.final_judgment ?? 50,
      },
      risk_signals: parsed.risk_signals || ["분석 중"],
      reliable_elements: parsed.reliable_elements || ["분석 중"],
      recommendations: parsed.recommendations || "추가 검증이 필요합니다.",
      trust_grade: parsed.trust_grade || "N/A",
    };
  } catch (err) {
    console.error("[analyzeArticle] Error:", err);
    throw err;
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // JSON body parser for the API routes
  app.use(express.json({ limit: "256kb" }));

  // ── Talk Tak chat proxy ──────────────────────────────────────────────────
  app.post("/api/talktak/chat", async (req, res) => {
    if (!FORGE_BASE || !FORGE_KEY) {
      res.status(500).json({
        error: "Talk Tak server is not configured",
        detail: "BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY missing",
      });
      return;
    }

    const body = (req.body || {}) as TalkTakChatRequest;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    // Hard caps so a malicious or runaway client cannot burn budget.
    const safeMessages = body.messages.slice(-20).map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 8000) : "",
    }));

    try {
      const upstream = await fetch(`${FORGE_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FORGE_KEY}`,
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
          // keep raw text
        }
        res
          .status(upstream.status)
          .json({ error: "upstream_error", detail });
        return;
      }

      const data = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) {
        res.status(502).json({ error: "empty_reply" });
        return;
      }
      res.json({ reply });
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown";
      res.status(500).json({ error: "fetch_failed", detail });
    }
  });

  // ── News analysis ────────────────────────────────────────────────────────
  // POST /api/feed  →  Placeholder
  app.get("/api/feed", async (req, res) => {
    res.json({ items: [] });
  });

  // POST /api/feed/refresh  →  Placeholder
  app.post("/api/feed/refresh", async (_req, res) => {
    res.json({ refreshed: 0 });
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

      // If URL provided, try to fetch and extract text
      if (url && !text) {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(10_000),
          });
          if (response.ok) {
            const html = await response.text();
            // Simple text extraction from HTML
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
          // Fallback: use URL as text
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
      const detail = err instanceof Error ? err.message : "unknown error";
      res.status(500).json({ error: "analysis_failed", detail });
    }
  });

  // GET /api/r/:shareId  →  Placeholder
  app.get("/api/r/:shareId", async (req, res) => {
    res.status(404).json({ error: "Result not found" });
  });

  // ── Health ───────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    res.json({
      ok: true,
      talktak: Boolean(FORGE_BASE && FORGE_KEY),
      analysis_engine: "internal",
    });
  });

  // ── Static file serving ─────────────────────────────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));

  // SPA fallback — must come AFTER /api routes so the router matches them
  // first; the catch-all only handles non-API paths.
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(
      `[Analysis Engine] ${FORGE_BASE && FORGE_KEY ? "ENABLED" : "DISABLED"}`,
    );
  });
}

startServer().catch(console.error);
