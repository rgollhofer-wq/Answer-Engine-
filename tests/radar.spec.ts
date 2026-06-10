import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../src/server.js";
import { InMemoryAnswerLogRepository, NullCacheProvider } from "../src/data/repo.js";
import { LlmProvider, LlmRequest } from "../src/providers/llm.js";

class MockRadarProvider implements LlmProvider {
  model = "test-radar-model";

  async completeJson<T>(request: LlmRequest): Promise<T> {
    expect(request.systemPrompt).toContain("LocalRadar");
    expect(request.userPrompt).toContain("Scouted website evidence");

    return {
      business_type: "home services provider",
      executive_summary:
        "Acme Plumbing is positioned as a local plumbing provider, but it can make service-area, FAQ, and trust proof content easier for AI systems to extract.",
      ai_visibility_scorecard: {
        overall_score: 76,
        grade: "C",
        categories: {
          local_relevance: 72,
          service_clarity: 82,
          ai_answer_readiness: 64,
          conversion_path: 84,
          trust_signals: 78,
        },
      },
      opportunities: [
        {
          title: "Expand answer-ready FAQ content",
          priority: "high",
          rationale: "The site has service detail but limited direct answers to buying questions.",
          recommended_action: "Add FAQs for pricing, emergency availability, service area, and appointment timing.",
        },
      ],
      recommended_next_steps: ["Prioritize service-area pages and FAQ content."],
      presentation_notes: ["Use the scorecard to anchor a concise sales conversation."],
    } as T;
  }
}

function createApp() {
  return buildServer({
    provider: new MockRadarProvider(),
    repo: new InMemoryAnswerLogRepository(),
    cache: new NullCacheProvider(),
  });
}

describe("/radar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scouts a website and returns a presentation-ready report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `<!doctype html>
          <html>
            <head>
              <title>Acme Plumbing Denver</title>
              <meta name="description" content="Licensed plumbing repairs serving Denver with emergency appointments." />
            </head>
            <body>
              <h1>Denver Plumbing Services</h1>
              <h2>Emergency repair, drain cleaning, and water heaters</h2>
              <p>Call today for a quote. Licensed and insured with hundreds of reviews.</p>
              <a href="/services">Services</a>
              <a href="/contact">Contact</a>
              <a href="/faq">FAQ</a>
            </body>
          </html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          }
        )
      )
    );

    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/radar",
      payload: { website_url: "https://example.com" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.request_id).toBeTypeOf("string");
    expect(body.website_url).toBe("https://example.com/");
    expect(body.business_type).toBe("home services provider");
    expect(body.executive_summary).toContain("Acme Plumbing");
    expect(body.ai_visibility_scorecard.overall_score).toBe(76);
    expect(body.ai_visibility_scorecard.categories.ai_answer_readiness).toBe(64);
    expect(body.opportunities[0].priority).toBe("high");
    expect(body.recommended_next_steps).toHaveLength(1);
    expect(body.presentation_notes).toHaveLength(1);
    expect(body.scout.title).toBe("Acme Plumbing Denver");
    expect(body.scout.business_type_guess).toBe("home services provider");
    expect(body.scout.signals).toContain("phone or contact path");
    expect(body.scout.internal_links).toContain("https://example.com/services");
    expect(body.trace.provider.llm_model).toBe("test-radar-model");
    expect(body.trace.cache_hit).toBe(false);
  });

  it("rejects non-http URLs", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/radar",
      payload: { website_url: "mailto:sales@example.com" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("validation_error");
  });
});
