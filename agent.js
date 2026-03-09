// ============================================================
// AI Pain Point Intelligence Agent
// Runs daily, scrapes platforms, analyzes with Claude,
// saves results to results/latest.json and a dated archive
// ============================================================

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Config ───────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;       // optional
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET; // optional
const HN_ENABLED = true;   // always free, no key needed

const REDDIT_SUBREDDITS = [
  "MachineLearning", "ChatGPT", "programming", "datascience",
  "artificial", "LocalLLaMA", "OpenAI", "devops", "ProductManagement"
];

const HN_QUERIES = [
  "AI workflow", "LLM frustration", "ChatGPT broken",
  "AI agent problem", "hallucination production", "AI integration"
];

const RESULTS_DIR = path.join(__dirname, "results");
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);

// ── Helpers ───────────────────────────────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { headers: { "User-Agent": "AI-PainPoint-Agent/1.0", ...headers } };
    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    }).on("error", reject);
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function log(msg) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${msg}`);
}

// ── Scrapers ─────────────────────────────────────────────────

// Hacker News (free, no auth needed)
async function scrapeHackerNews() {
  log("📡 Scraping Hacker News...");
  const posts = [];
  for (const query of HN_QUERIES.slice(0, 3)) {
    try {
      const encoded = encodeURIComponent(query);
      const data = await httpsGet(
        `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=comment,story&hitsPerPage=10&numericFilters=created_at_i>${Math.floor(Date.now()/1000) - 86400*7}`
      );
      if (data.hits) {
        for (const hit of data.hits) {
          const text = hit.comment_text || hit.story_text || hit.title || "";
          if (text.length > 50) {
            posts.push({
              source: "Hacker News",
              text: text.replace(/<[^>]+>/g, "").slice(0, 500),
              score: hit.points || hit.num_comments || 0,
              url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            });
          }
        }
      }
      await sleep(300);
    } catch (e) {
      log(`  ⚠️  HN query failed: ${e.message}`);
    }
  }
  log(`  ✅ HN: ${posts.length} posts collected`);
  return posts;
}

// Reddit (optional — works better with API keys but has a public fallback)
async function scrapeReddit() {
  log("📡 Scraping Reddit...");
  const posts = [];

  // Try public JSON endpoint (no auth, rate limited but works for low volume)
  for (const sub of REDDIT_SUBREDDITS.slice(0, 5)) {
    try {
      const data = await httpsGet(
        `https://www.reddit.com/r/${sub}/search.json?q=AI+frustration+OR+AI+problem+OR+AI+broken+OR+LLM+issue&sort=top&t=week&limit=10`,
        { "User-Agent": "AI-PainPoint-Agent/1.0 (research bot)" }
      );
      const items = data?.data?.children || [];
      for (const item of items) {
        const d = item.data;
        if ((d.score || 0) >= 10) {
          posts.push({
            source: "Reddit",
            subreddit: d.subreddit,
            text: `[${d.subreddit}] ${d.title}. ${(d.selftext || "").slice(0, 300)}`,
            score: d.score,
            url: `https://reddit.com${d.permalink}`,
          });
        }
      }
      await sleep(1000); // Be polite to Reddit
    } catch (e) {
      log(`  ⚠️  Reddit r/${sub} failed: ${e.message}`);
    }
  }
  log(`  ✅ Reddit: ${posts.length} posts collected`);
  return posts;
}

// GitHub Issues (free, no auth needed for public repos)
async function scrapeGitHub() {
  log("📡 Scraping GitHub Issues...");
  const repos = [
    "langchain-ai/langchain",
    "openai/openai-python",
    "microsoft/autogen",
    "run-llama/llama_index",
  ];
  const posts = [];
  for (const repo of repos) {
    try {
      const data = await httpsGet(
        `https://api.github.com/search/issues?q=repo:${repo}+frustrating+OR+broken+OR+unreliable+OR+hallucin+is:issue&sort=reactions&per_page=5`,
        { Accept: "application/vnd.github.v3+json" }
      );
      for (const issue of data.items || []) {
        posts.push({
          source: "GitHub",
          repo,
          text: `[${repo}] ${issue.title}. ${(issue.body || "").slice(0, 300)}`,
          score: (issue.reactions?.total_count || 0) + (issue.comments || 0),
          url: issue.html_url,
        });
      }
      await sleep(500);
    } catch (e) {
      log(`  ⚠️  GitHub ${repo} failed: ${e.message}`);
    }
  }
  log(`  ✅ GitHub: ${posts.length} issues collected`);
  return posts;
}

// ── Claude Analysis ───────────────────────────────────────────
async function analyzeWithClaude(posts) {
  log("🧠 Sending to Claude for analysis...");

  const postText = posts
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
    .map((p, i) => `[${i + 1}] Source: ${p.source}\nScore: ${p.score}\nText: ${p.text}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are an AI pain point intelligence analyst. Analyze user posts from tech platforms and identify the top 10 most significant AI workflow pain points.

Return ONLY valid JSON in this exact structure (no markdown, no preamble):
{
  "date": "YYYY-MM-DD",
  "total_posts_analyzed": 0,
  "dominant_theme": "One sentence about the #1 theme",
  "summary": "3-4 sentence executive summary of trends",
  "painpoints": [
    {
      "rank": 1,
      "title": "Concise title (max 8 words)",
      "description": "2-3 sentence description",
      "industry": "Engineering|Marketing|Healthcare|Finance|Education|Design|Legal|Sales|General",
      "severity": 8,
      "frequency": "High|Medium|Low",
      "tools_affected": ["GPT-4", "Copilot"],
      "sample_quotes": ["A short representative quote"],
      "source_platforms": ["Reddit", "Hacker News"]
    }
  ]
}`;

  const response = await httpsPost(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-opus-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Analyze these ${posts.length} posts and return the top 10 AI workflow pain points:\n\n${postText}` }],
    },
    {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    }
  );

  const text = response.content?.map((b) => b.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  const result = JSON.parse(clean);
  result.total_posts_analyzed = posts.length;
  result.date = new Date().toISOString().slice(0, 10);
  return result;
}

// ── Save Results ──────────────────────────────────────────────
function saveResults(data) {
  const today = new Date().toISOString().slice(0, 10);
  const latestPath = path.join(RESULTS_DIR, "latest.json");
  const archivedPath = path.join(RESULTS_DIR, `${today}.json`);

  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(archivedPath, JSON.stringify(data, null, 2));
  log(`💾 Saved to results/latest.json and results/${today}.json`);

  // Print summary to console (visible in GitHub Actions logs)
  console.log("\n========================================");
  console.log(`📊 PAIN POINT REPORT — ${today}`);
  console.log(`Posts analyzed: ${data.total_posts_analyzed}`);
  console.log(`Dominant theme: ${data.dominant_theme}`);
  console.log("----------------------------------------");
  data.painpoints?.forEach((p) => {
    console.log(`#${p.rank} [${p.industry}] ${p.title} (severity: ${p.severity}/10)`);
  });
  console.log("========================================\n");
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  log("🚀 AI Pain Point Agent starting...");

  if (!ANTHROPIC_API_KEY) {
    console.error("❌ Missing ANTHROPIC_API_KEY environment variable.");
    process.exit(1);
  }

  // Scrape all sources in parallel
  const [hnPosts, redditPosts, githubPosts] = await Promise.all([
    scrapeHackerNews().catch(() => []),
    scrapeReddit().catch(() => []),
    scrapeGitHub().catch(() => []),
  ]);

  const allPosts = [...hnPosts, ...redditPosts, ...githubPosts];
  log(`📥 Total posts collected: ${allPosts.length}`);

  if (allPosts.length < 5) {
    log("⚠️  Too few posts collected. Check API access.");
  }

  const results = await analyzeWithClaude(allPosts);
  saveResults(results);
  log("✅ Agent complete!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
