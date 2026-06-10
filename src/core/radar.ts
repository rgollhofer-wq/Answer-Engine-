import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { LlmProvider } from "../providers/llm.js";
import { hashPayload } from "../utils/hash.js";
import { timeOperation } from "../utils/timing.js";
import { CacheProvider } from "../data/repo.js";

export const radarRequestSchema = z.object({
  website_url: z.string().min(1),
});

export type RadarRequest = z.infer<typeof radarRequestSchema>;

export interface RadarSiteScout {
  requested_url: string;
  final_url: string;
  domain: string;
  title: string | null;
  meta_description: string | null;
  headings: string[];
  visible_text_sample: string;
  internal_links: string[];
  signals: string[];
  business_type_guess: string;
  scouting_status: "scouted" | "partial";
}

export interface RadarOpportunity {
  title: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  recommended_action: string;
}

export interface RadarScorecard {
  overall_score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: {
    local_relevance: number;
    service_clarity: number;
    ai_answer_readiness: number;
    conversion_path: number;
    trust_signals: number;
  };
}

export interface RadarReport {
  request_id: string;
  website_url: string;
  business_type: string;
  executive_summary: string;
  ai_visibility_scorecard: RadarScorecard;
  opportunities: RadarOpportunity[];
  recommended_next_steps: string[];
  presentation_notes: string[];
  scout: RadarSiteScout;
  trace: {
    provider: {
      llm_model: string;
      latency_ms: number;
    };
    cache_hit: boolean;
  };
}

interface RadarDraft {
  business_type: string;
  executive_summary: string;
  ai_visibility_scorecard: RadarScorecard;
  opportunities: RadarOpportunity[];
  recommended_next_steps: string[];
  presentation_notes: string[];
}

const RADAR_SYSTEM_PROMPT = `You are LocalRadar™, a local-business sales diagnostic analyst.
Create a presentation-ready AI Visibility Scorecard from the scouted website evidence.
Focus on whether answer engines and local buyers can understand who the business serves, what it sells, where it operates, why it is credible, and how to convert.
Return ONLY valid JSON. Do not invent exact facts that are not supported by the scout.`;

const RADAR_SCHEMA = `{
  "business_type": "string",
  "executive_summary": "string",
  "ai_visibility_scorecard": {
    "overall_score": 0-100,
    "grade": "A|B|C|D|F",
    "categories": {
      "local_relevance": 0-100,
      "service_clarity": 0-100,
      "ai_answer_readiness": 0-100,
      "conversion_path": 0-100,
      "trust_signals": 0-100
    }
  },
  "opportunities": [
    { "title": "string", "priority": "high|medium|low", "rationale": "string", "recommended_action": "string" }
  ],
  "recommended_next_steps": ["string"],
  "presentation_notes": ["string"]
}`;

const scoreSchema = z.number().min(0).max(100);

const radarDraftSchema: z.ZodType<RadarDraft> = z.object({
  business_type: z.string().min(1),
  executive_summary: z.string().min(1),
  ai_visibility_scorecard: z.object({
    overall_score: scoreSchema,
    grade: z.enum(["A", "B", "C", "D", "F"]),
    categories: z.object({
      local_relevance: scoreSchema,
      service_clarity: scoreSchema,
      ai_answer_readiness: scoreSchema,
      conversion_path: scoreSchema,
      trust_signals: scoreSchema,
    }),
  }),
  opportunities: z
    .array(
      z.object({
        title: z.string().min(1),
        priority: z.enum(["high", "medium", "low"]),
        rationale: z.string().min(1),
        recommended_action: z.string().min(1),
      })
    )
    .min(1),
  recommended_next_steps: z.array(z.string().min(1)).min(1),
  presentation_notes: z.array(z.string().min(1)).min(1),
});

function validateHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("website_url must be a valid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("website_url must use http or https");
  }

  return url;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? normalizeWhitespace(decodeEntities(match[1])) : null;
}

function allMatches(html: string, pattern: RegExp, limit: number): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(pattern)) {
    const raw = match[1] ?? match[2];
    if (!raw) continue;
    const value = normalizeWhitespace(stripHtml(raw));
    if (value && !values.includes(value)) values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

function extractInternalLinks(html: string, baseUrl: URL): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.hostname === baseUrl.hostname && ["http:", "https:"].includes(url.protocol)) {
        url.hash = "";
        const normalized = url.toString();
        if (!links.includes(normalized)) links.push(normalized);
      }
    } catch {
      continue;
    }
    if (links.length >= 20) break;
  }
  return links;
}

function inferSignals(text: string, links: string[]): string[] {
  const haystack = `${text} ${links.join(" ")}`.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["local address or service area", /\b(address|directions|service area|near me|serving|located in)\b/],
    ["phone or contact path", /\b(phone|call|contact|appointment|book|quote|estimate)\b|\(\d{3}\)\s*\d{3}/],
    ["services or products described", /\b(services|products|solutions|menu|inventory|repair|installation|consultation)\b/],
    ["trust proof", /\b(reviews|testimonials|certified|licensed|insured|warranty|years of experience|award)\b/],
    ["FAQ or answer content", /\b(faq|frequently asked|questions|how much|what is|when should|why choose)\b/],
  ];

  return checks.filter(([, pattern]) => pattern.test(haystack)).map(([label]) => label);
}

function inferBusinessType(text: string): string {
  const haystack = text.toLowerCase();
  const checks: Array<[string, RegExp]> = [
    ["restaurant or food service", /\b(restaurant|cafe|pizza|menu|catering|bar|grill|bakery)\b/],
    ["auto dealer or auto service", /\b(auto|vehicle|car|dealer|dealership|parts|brake|tire|oil change|collision)\b/],
    ["home services provider", /\b(plumbing|hvac|roofing|electrician|landscaping|pest control|remodeling|contractor)\b/],
    ["medical or dental practice", /\b(doctor|dentist|clinic|patient|appointment|health|therapy|chiropractic)\b/],
    ["legal services firm", /\b(attorney|law firm|legal|lawyer|injury|estate|criminal defense)\b/],
    ["real estate business", /\b(real estate|realtor|homes for sale|property management|brokerage)\b/],
  ];

  return checks.find(([, pattern]) => pattern.test(haystack))?.[0] ?? "local business";
}

export async function scoutWebsite(websiteUrl: string, timeoutMs: number): Promise<RadarSiteScout> {
  const requested = validateHttpUrl(websiteUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(requested, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "AnswerEngine-LocalRadar/1.0 (+https://example.com/radar)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Website returned HTTP ${response.status}`);
    }

    const html = await response.text();
    const finalUrl = new URL(response.url || requested.toString());
    const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescription = firstMatch(
      html,
      /<meta\s+[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
    );
    const headings = allMatches(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, 12);
    const visibleText = normalizeWhitespace(stripHtml(html)).slice(0, 4000);
    const internalLinks = extractInternalLinks(html, finalUrl);
    const combinedText = [title, metaDescription, headings.join(" "), visibleText].filter(Boolean).join(" ");
    const signals = inferSignals(combinedText, internalLinks);

    return {
      requested_url: requested.toString(),
      final_url: finalUrl.toString(),
      domain: finalUrl.hostname,
      title,
      meta_description: metaDescription,
      headings,
      visible_text_sample: visibleText,
      internal_links: internalLinks,
      signals,
      business_type_guess: inferBusinessType(combinedText),
      scouting_status: signals.length >= 2 ? "scouted" : "partial",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function scoreGrade(score: number): RadarScorecard["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function fallbackDraft(scout: RadarSiteScout): RadarDraft {
  const categoryScores = {
    local_relevance: scout.signals.includes("local address or service area") ? 74 : 45,
    service_clarity: scout.signals.includes("services or products described") ? 78 : 48,
    ai_answer_readiness: scout.signals.includes("FAQ or answer content") ? 72 : 42,
    conversion_path: scout.signals.includes("phone or contact path") ? 76 : 46,
    trust_signals: scout.signals.includes("trust proof") ? 75 : 44,
  };
  const overall = Math.round(
    Object.values(categoryScores).reduce((sum, value) => sum + value, 0) / Object.values(categoryScores).length
  );

  return {
    business_type: scout.business_type_guess,
    executive_summary: `${scout.domain} appears to be a ${scout.business_type_guess}. LocalRadar found ${scout.signals.length} AI visibility signal(s), with the biggest opportunity in making services, location, trust proof, and conversion paths easier for answer engines to extract.`,
    ai_visibility_scorecard: {
      overall_score: overall,
      grade: scoreGrade(overall),
      categories: categoryScores,
    },
    opportunities: [
      {
        title: "Create answer-ready service pages",
        priority: "high",
        rationale: "Answer engines need clear, extractable descriptions of services, locations served, and buyer outcomes.",
        recommended_action: "Add concise service sections with who it is for, location coverage, pricing or process cues, and next-step calls to action.",
      },
      {
        title: "Strengthen local trust signals",
        priority: "medium",
        rationale: "Reviews, credentials, warranties, and local proof help buyers and AI systems understand why the business is credible.",
        recommended_action: "Surface reviews, certifications, years in business, guarantees, and local project examples near conversion points.",
      },
      {
        title: "Add FAQ content for high-intent questions",
        priority: "medium",
        rationale: "Question-and-answer content improves eligibility for AI answers and sales discovery snippets.",
        recommended_action: "Publish FAQs that answer cost, timing, service area, qualification, and comparison questions in plain language.",
      },
    ],
    recommended_next_steps: [
      "Confirm the highest-value service lines and target locations.",
      "Build or revise priority pages using answer-ready headings and concise proof points.",
      "Track AI visibility improvements with a follow-up LocalRadar scan after changes ship.",
    ],
    presentation_notes: [
      "Lead with the overall score, then show the category gaps that connect directly to revenue opportunities.",
      "Position recommendations as practical website improvements, not a full rebuild.",
    ],
  };
}

function buildRadarUserPrompt(scout: RadarSiteScout): string {
  return `Scouted website evidence:\n${JSON.stringify(scout, null, 2)}\n\nReturn JSON with this schema:\n${RADAR_SCHEMA}`;
}

export async function handleRadarRequest(params: {
  request: RadarRequest;
  provider: LlmProvider;
  cache: CacheProvider;
  cacheTtlSeconds: number;
  temperature: number;
  timeoutMs: number;
}): Promise<RadarReport> {
  const url = validateHttpUrl(params.request.website_url).toString();
  const cacheKey = hashPayload(JSON.stringify({ radar_url: url }));
  const cached = await params.cache.get<RadarReport>(cacheKey);
  if (cached) {
    return {
      ...cached,
      request_id: uuidv4(),
      trace: {
        ...cached.trace,
        cache_hit: true,
        provider: { ...cached.trace.provider, latency_ms: 0 },
      },
    };
  }

  const { result: scout, latencyMs: scoutLatency } = await timeOperation(() =>
    scoutWebsite(url, params.timeoutMs)
  );

  const { result: draft, latencyMs: llmLatency } = await timeOperation(async () => {
    try {
      const response = await params.provider.completeJson<RadarDraft>({
        systemPrompt: RADAR_SYSTEM_PROMPT,
        userPrompt: buildRadarUserPrompt(scout),
        temperature: params.temperature,
        timeoutMs: params.timeoutMs,
      });
      const parsed = radarDraftSchema.safeParse(response);
      return parsed.success ? parsed.data : fallbackDraft(scout);
    } catch {
      return fallbackDraft(scout);
    }
  });

  const report: RadarReport = {
    request_id: uuidv4(),
    website_url: url,
    ...draft,
    scout,
    trace: {
      provider: {
        llm_model: params.provider.model,
        latency_ms: scoutLatency + llmLatency,
      },
      cache_hit: false,
    },
  };

  await params.cache.set(cacheKey, report, params.cacheTtlSeconds);
  return report;
}
