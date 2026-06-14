import cron from "node-cron";
import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DATABASE_URL?.split("@")[1]?.split(":")[0] || "localhost",
  user: process.env.DATABASE_URL?.split("://")[1]?.split(":")[0] || "root",
  password: process.env.DATABASE_URL?.split(":")[1]?.split("@")[0] || "",
  database: process.env.DATABASE_URL?.split("/").pop()?.split("?")[0] || "cubixa",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool: mysql.Pool | null = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

interface RSSItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  content?: string;
}

async function parseRSSFeed(url: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[RSS] Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const text = await response.text();

    // Simple XML parsing (for production, use xml2js or similar)
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const itemText = match[1];
      const titleMatch = itemText.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const descMatch = itemText.match(/<description[^>]*>([\s\S]*?)<\/description>/);
      const linkMatch = itemText.match(/<link[^>]*>([\s\S]*?)<\/link>/);
      const pubDateMatch = itemText.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);

      items.push({
        title: titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "",
        description: descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : "",
        link: linkMatch ? linkMatch[1].trim() : "",
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
      });
    }

    return items;
  } catch (err) {
    console.error(`[RSS] Error parsing ${url}:`, err);
    return [];
  }
}

async function fetchHeadlines() {
  console.log("[RSS] Starting headline fetch...");

  try {
    const pool = await getPool();
    const conn = await pool.getConnection();

    // Get all active RSS sources
    const [sources] = (await conn.query(
      "SELECT id, url FROM rss_sources WHERE active = TRUE",
    )) as any[];

    let totalAdded = 0;

    for (const source of sources) {
      const items = await parseRSSFeed(source.url);

      for (const item of items.slice(0, 10)) {
        // Limit to 10 items per source
        try {
          await conn.query(
            `INSERT IGNORE INTO articles (source_id, title, description, link, pub_date, fetched_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [source.id, item.title, item.description, item.link, item.pubDate],
          );
          totalAdded++;
        } catch (err) {
          // Duplicate or other error, skip
        }
      }
    }

    await conn.release();
    console.log(`[RSS] Fetched ${totalAdded} new articles`);
  } catch (err) {
    console.error("[RSS] Error fetching headlines:", err);
  }
}

export function startRSSScheduler() {
  console.log("[RSS] Scheduler started");

  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    await fetchHeadlines();
  });

  // Also run once on startup after 10 seconds
  setTimeout(() => {
    fetchHeadlines();
  }, 10000);
}

// Manual trigger for testing
export async function triggerRSSFetch() {
  await fetchHeadlines();
}
