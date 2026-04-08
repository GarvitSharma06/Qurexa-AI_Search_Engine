import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import { pipeline } from "@xenova/transformers";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Search Engine Logic ---
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  const INDEX_FILE = path.join(process.cwd(), "index.json");
  const EMBEDDINGS_FILE = path.join(process.cwd(), "embeddings.json");

  let index = { documents: {}, invertedIndex: {}, totalDocs: 0 };
  let embeddings = {};
  let extractor: any = null;

  // Initialize Search
  try {
    if (fs.existsSync(INDEX_FILE)) {
      index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
    }
    if (fs.existsSync(EMBEDDINGS_FILE)) {
      embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, "utf-8"));
    }
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  } catch (err) {
    console.error("Search initialization error:", err);
  }

  // Tokenizer
  const STOPWORDS = new Set(["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "it", "its", "was", "are", "be", "been", "has", "have", "had", "that", "this", "these", "those", "as", "not", "no", "so", "if", "we", "he", "she", "they", "you", "i", "my", "their", "our", "his", "her", "which", "who", "what", "when", "where", "will", "can", "do", "did", "does", "more", "also", "than", "then", "into", "over", "about", "up", "out", "after", "between", "each", "how", "all", "both", "through", "during", "before", "s", "t", "re"]);

  function tokenize(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  }

  function cosineSimilarity(a: number[], b: number[]) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  function normalize(scores: Record<string, number>) {
    const vals = Object.values(scores);
    const max = Math.max(...vals) || 1;
    const result: Record<string, number> = {};
    for (const [id, score] of Object.entries(scores)) {
      result[id] = score / max;
    }
    return result;
  }

  // API Routes
  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: "Missing query" });

    // TF-IDF
    const queryTokens = tokenize(query);
    const tfidfRaw: Record<string, number> = {};
    for (const term of queryTokens) {
      const postings = (index.invertedIndex as any)[term] || [];
      for (const { docId, tfidf } of postings) {
        tfidfRaw[docId] = (tfidfRaw[docId] || 0) + tfidf;
      }
    }
    const tfidfScores = normalize(tfidfRaw);

    // Semantic
    let semanticScores: Record<string, number> = {};
    let mode = "keyword";
    if (extractor && Object.keys(embeddings).length > 0) {
      const output = await extractor(query, { pooling: "mean", normalize: true });
      const queryVec = Array.from(output.data) as number[];
      for (const [docId, docVec] of Object.entries(embeddings)) {
        semanticScores[docId] = cosineSimilarity(queryVec, docVec as number[]);
      }
      semanticScores = normalize(semanticScores);
      mode = "hybrid";
    }

    // Hybrid Blend
    const allDocIds = new Set([...Object.keys(tfidfScores), ...Object.keys(semanticScores)]);
    const results = Array.from(allDocIds)
      .map((docId) => {
        const tfidf = tfidfScores[docId] || 0;
        const semantic = semanticScores[docId] || 0;
        const score = 0.4 * tfidf + 0.6 * semantic;
        return {
          ...(index.documents as any)[docId],
          score: score.toFixed(4),
          mode,
        };
      })
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
      .slice(0, 10);

    res.json({ query, results, mode });
  });

  app.get("/api/weather", async (req, res) => {
    const { lat, lon } = req.query;
    try {
      // Using a free weather API or mock if needed. 
      // For now, let's use a public one or mock data if it fails.
      const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      res.json(response.data);
    } catch (err) {
      res.status(500).json({ error: "Weather fetch failed" });
    }
  });

  app.get("/api/news", async (req, res) => {
    try {
      // Mock news or use a public RSS feed
      const response = await axios.get("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en");
      const $ = cheerio.load(response.data, { xmlMode: true });
      const items: any[] = [];
      $("item").each((i, el) => {
        if (i < 10) {
          items.push({
            title: $(el).find("title").text(),
            link: $(el).find("link").text(),
            pubDate: $(el).find("pubDate").text(),
            source: $(el).find("source").text(),
          });
        }
      });
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: "News fetch failed" });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
