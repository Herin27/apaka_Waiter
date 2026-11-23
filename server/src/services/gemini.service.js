import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env.js';

const AI_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const memoryCache = new Map();

const getCached = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = (key, value, ttlMs = CACHE_TTL_MS) => {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const withTimeout = (promise, ms = AI_TIMEOUT_MS) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms)
    ),
  ]);
};

const getModel = () => {
  if (!env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: env.GEMINI_MODEL || 'gemini-2.5-flash' });
};

const stripMarkdownJson = (raw) => {
  return String(raw || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
};

// Strict Zod schema for voice order output
const voiceParsedSchema = z.array(
  z.object({
    itemId: z.string().min(1),
    quantity: z.number().int().min(1).max(25),
    confidence: z.number().min(0).max(1),
  })
);

// Heuristic offline/fallback voice parser when Gemini is unavailable or times out
const fallbackParseTranscript = (transcript, menuCatalog) => {
  const text = String(transcript || '').toLowerCase();
  const numberWords = {
    one: 1, ek: 1, aik: 1, '1': 1,
    two: 2, do: 2, be: 2, '2': 2,
    three: 3, teen: 3, tran: 3, '3': 3,
    four: 4, char: 4, '4': 4,
    five: 5, paanch: 5, panch: 5, '5': 5,
  };

  const matched = [];
  for (const m of menuCatalog) {
    const names = [m.name?.en, m.name?.hi, m.name?.gu]
      .filter(Boolean)
      .map((s) => s.toLowerCase());

    const hit = names.some((n) => {
      const tokens = n.split(/\s+/).filter((w) => w.length > 3);
      return tokens.some((tok) => text.includes(tok)) || text.includes(n);
    });

    if (hit) {
      let qty = 1;
      for (const [word, num] of Object.entries(numberWords)) {
        if (new RegExp(`\b${word}\b`, 'i').test(text)) {
          qty = num;
          break;
        }
      }
      matched.push({ itemId: String(m._id), quantity: qty, confidence: 0.65 });
    }
  }

  return matched.slice(0, 6);
};

// 1. VOICE ORDER PARSER
export const parseVoiceOrderWithGemini = async ({ transcript, language = 'en-IN', menuCatalog }) => {
  const validIds = new Set(menuCatalog.map((m) => String(m._id)));
  const compactMenu = menuCatalog.map((m) => ({
    id: String(m._id),
    en: m.name?.en || '',
    hi: m.name?.hi || '',
    gu: m.name?.gu || '',
  }));

  const cacheKey = `voice:${language}:${transcript.trim().toLowerCase()}:${compactMenu.length}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const model = getModel();
  if (!model) {
    return fallbackParseTranscript(transcript, menuCatalog);
  }

  // EXACT PROMPT SENT TO GEMINI FOR VOICE ORDERING
  const prompt = `You are a restaurant voice order parser.
Input speech transcript (${language}): "${transcript}"
Available menu items (JSON): ${JSON.stringify(compactMenu)}

Match spoken items and quantities (including Hindi/Gujarati/Hinglish numbers like ek=1, do=2, teen=3, be=2, tran=3) to the available menu items.
Return STRICT JSON ONLY — no markdown fences, no commentary, no extra text.
Format: [{"itemId":"<id>","quantity":1,"confidence":0.95}]
Only include items from the provided menu list.`;

  try {
    const result = await withTimeout(model.generateContent(prompt));
    const cleaned = stripMarkdownJson(result.response.text());
    const parsedJson = JSON.parse(cleaned);
    const validated = voiceParsedSchema.safeParse(parsedJson);

    if (!validated.success) {
      return fallbackParseTranscript(transcript, menuCatalog);
    }

    // Drop any unknown itemIds not in branch menu
    const sanitized = validated.data.filter((entry) => validIds.has(entry.itemId));
    setCached(cacheKey, sanitized, 60 * 1000);
    return sanitized;
  } catch {
    return fallbackParseTranscript(transcript, menuCatalog);
  }
};

// 2. RECOMMENDATION RE-RANKER (Co-occurrence first, Gemini optional re-rank)
export const rerankRecommendationsWithGemini = async ({
  contextItemNames = [],
  candidateItems = [],
}) => {
  if (candidateItems.length <= 1) return candidateItems.map((c) => c._id);

  const cacheKey = `rec:${contextItemNames.join(',')}:${candidateItems
    .map((c) => c._id)
    .join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const defaultOrder = candidateItems.map((c) => String(c._id));
  const model = getModel();
  if (!model) return defaultOrder;

  // EXACT PROMPT SENT TO GEMINI FOR RECOMMENDATION RE-RANKING
  const prompt = `Given current order/selected items: ${JSON.stringify(contextItemNames)}.
Rank these candidate companion menu items from best pairing to least:
${JSON.stringify(candidateItems.map((c) => ({ id: String(c._id), name: c.name?.en || '' })))}

Return STRICT JSON ONLY as an array of item IDs in recommended order, e.g. ["id1","id2"].`;

  try {
    const result = await withTimeout(model.generateContent(prompt), 3500);
    const parsed = JSON.parse(stripMarkdownJson(result.response.text()));
    if (!Array.isArray(parsed)) return defaultOrder;

    const allowed = new Set(defaultOrder);
    const ordered = parsed.map(String).filter((id) => allowed.has(id));
    for (const id of defaultOrder) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    setCached(cacheKey, ordered);
    return ordered;
  } catch {
    return defaultOrder;
  }
};

// 3. DEMAND FORECASTING ADVICE (8-week weekday x item aggregation -> Gemini stocking advice)
export const generateDemandForecastAdvice = async ({ branchId, weekdayStats }) => {
  const cacheKey = `forecast:${branchId}:${JSON.stringify(weekdayStats).slice(0, 120)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const fallbackAdvice =
    weekdayStats.length > 0
      ? `Based on the last 8 weeks of orders, stock extra prep quantities for ${
          weekdayStats[0]?.weekday || 'peak days'
        } and keep top-moving items like ${
          weekdayStats[0]?.topItems?.[0]?.name || 'bestsellers'
        } well supplied.`
      : 'Collect more order history over upcoming weeks to generate tailored weekday stocking advice.';

  const model = getModel();
  if (!model) {
    return { advice: fallbackAdvice, generatedByAi: false };
  }

  // EXACT PROMPT SENT TO GEMINI FOR DEMAND FORECASTING
  const prompt = `You are a restaurant operations analyst.
Analyze the following 8-week historical order summary grouped by weekday and top items:
${JSON.stringify(weekdayStats)}

Provide concise, practical, plain-language stocking and prep advice (3 to 5 bullet points, e.g., "Stock more paneer for Saturday"). Do not use raw JSON.`;

  try {
    const result = await withTimeout(model.generateContent(prompt));
    const text = result.response.text().trim();
    const out = { advice: text || fallbackAdvice, generatedByAi: Boolean(text) };
    setCached(cacheKey, out, 10 * 60 * 1000);
    return out;
  } catch {
    return { advice: fallbackAdvice, generatedByAi: false };
  }
};

// 4. DAILY OWNER SUMMARY (11 PM job -> plain-language summary)
export const generateDailyOwnerSummaryText = async ({ dateStr, metrics }) => {
  const fallback = `End-of-Day Summary (${dateStr}): Total revenue reached ₹${
    metrics.revenue || 0
  } across ${metrics.ordersCount || 0} orders. Top sellers: ${
    metrics.bestSellers?.length ? metrics.bestSellers.join(', ') : 'N/A'
  }. Late SLA orders: ${metrics.lateOrdersCount || 0}; low ratings (≤3★): ${
    metrics.lowRatingsCount || 0
  }.`;

  const model = getModel();
  if (!model) {
    return { summaryText: fallback, generatedByAi: false };
  }

  // EXACT PROMPT SENT TO GEMINI FOR DAILY OWNER SUMMARY
  const prompt = `Write a crisp, executive end-of-day restaurant owner summary for ${dateStr} using these exact numbers:
${JSON.stringify(metrics)}

Summarize revenue, best sellers, any late orders, and any low ratings in 4-5 clear sentences. Never invent numbers.`;

  try {
    const result = await withTimeout(model.generateContent(prompt));
    const text = result.response.text().trim();
    return { summaryText: text || fallback, generatedByAi: Boolean(text) };
  } catch {
    return { summaryText: fallback, generatedByAi: false };
  }
};
