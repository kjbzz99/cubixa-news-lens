/**
 * voiceChat — calls our own backend `/api/talktak/chat` proxy, which
 * authenticates to Forge server-side using BUILT_IN_FORGE_API_KEY. No API
 * key is ever sent from or stored in the browser.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

const ENDPOINT = "/api/talktak/chat";

export function isVoiceChatConfigured(): boolean {
  // Server-side proxy is always present in this build; if the server itself
  // misconfigured Forge, the request will return a 500 we surface to the user.
  return true;
}

export async function chatComplete(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model: opts.model,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const data = await res.json();
      const upstream = data?.detail;
      detail =
        (upstream && (upstream.error?.message || upstream.message)) ||
        data?.error ||
        detail;
      if (typeof detail === "object") detail = JSON.stringify(detail);
    } catch {
      try {
        detail = await res.text();
      } catch {
        // ignore
      }
    }
    throw new Error(`Talk Tak 응답 실패: ${detail}`);
  }

  const data = (await res.json()) as { reply?: string };
  const reply = data.reply?.trim() ?? "";
  if (!reply) throw new Error("Talk Tak 응답이 비어 있어요.");
  return reply;
}
