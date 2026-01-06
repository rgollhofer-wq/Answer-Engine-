# AE v0 — Implementation Blueprint

## Authority
This blueprint implements the locked behavior defined in:
spec/answer-engine-v0.md

No reinterpretation is allowed.

## Purpose
AE v0 is a resolver.
It answers once with confidence or stops.
Silence is always preferred over a wrong answer.

## Core flow (must be followed exactly)
1. Ingest user intent + optional location
2. Resolve location (auto-detect first, one fallback ask only)
3. Collect candidates from all three sources:
   - Provider system data
   - Normalized feed
   - Public listings
4. Score each candidate
5. Apply thresholds
6. Either:
   - Answer and hand off
   - Ask one clarifying question
   - Stop and present next actions

## Confidence scoring (locked)
Each candidate produces a confidence breakdown:
- Authority (0–1)
- Agreement (0–1)
- Freshness (0–1)

Composite score formula:
score = 0.50 * Authority + 0.30 * Agreement + 0.20 * Freshness

Thresholds:
- >= 0.80 → confirmed answer
- 0.60–0.79 → ask exactly one clarifying question
- < 0.60 → stop (no confirmed answer)

After one clarification + re-score:
- If still < 0.80 → stop

## Tie handling
Candidates are tied if composite scores are within ±0.02.

Rules:
- Show 2–3 options max
- Default tie-breaker: closest distance
- Distance only breaks ties if difference > 5 miles

## Location rules
- Default: device auto-detection
- If denied or unclear: ask once for city or ZIP
- After city/ZIP input: proceed immediately
- Any location change forces full re-score

## Radius rules
- Local search max: 25 miles
- No silent expansion beyond 25 miles
- If no confirmed local result:
  - Ask user to expand nationally

National search behavior:
- Resolve availability + location only
- Do not promise shipping timing or costs
- Fulfillment handled by seller/dealer

## Handoff behavior
When an answer is confirmed:
- Present connect actions
  - Call (primary)
  - Directions (secondary)
- After connect is triggered, AE exits immediately

## Clarification rules
- One clarifying question maximum
- Only allowed when score is 0.60–0.79
- No follow-ups beyond the single clarification

## Stop actions (priority order)
When no confirmed answer:
1. Expand radius
2. Watch / Notify
3. Switch resolution mode

## Voice & interaction constraints
- Spoken response ≤ 12 seconds
- Calm, confident, neutral tone
- Never salesy
- Never apologetic
- No self-introduction unless asked
- Use “confirmed” / “not confirmed”
- Avoid “maybe”, “likely”, “should”

## Interruptions
- Stop speaking immediately
- Treat interruption as new intent
- Respond once

## Errors & timeouts
- Short, honest failure message
- One retry only

## Logging & privacy
- Log anonymized outcomes only:
  answered / clarified / stopped / handed_off
- Do not store raw queries or audio by default

## Non-goals (do not add)
- No dealer system integrations
- No background retries
- No silent radius expansion
- No additional questions
- No long explanations

## Build rule
If there is ambiguity:
Follow the spec literally.
Do not invent behavior.
