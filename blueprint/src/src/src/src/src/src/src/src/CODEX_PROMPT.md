# Codex Build Prompt — Answer Engine (AE) v0

You are implementing Answer Engine (AE) v0.

You must follow these documents exactly and in this order of authority:
1) spec/answer-engine-v0.md (authoritative behavior)
2) blueprint/implementation.md (required architecture and constraints)

## Absolute rules
- Do not reinterpret the spec.
- Do not add features.
- Do not add additional questions beyond what the spec allows.
- Silence is always preferred over a wrong answer.
- If something is ambiguous, follow the spec literally.

## Confidence model (locked)
For every candidate, compute:
- Authority (0..1)
- Agreement (0..1)
- Freshness (0..1)

Composite score:
score = 0.50 * Authority + 0.30 * Agreement + 0.20 * Freshness

Thresholds:
- score >= 0.80 → confirmed answer + handoff
- 0.60–0.79 → ask exactly ONE clarifying question, then re-score once
- score < 0.60 → stop (no confirmed answer)

After one clarification:
- If still < 0.80 → stop

## Location rules
- Default to device auto-detection
- If denied or unclear: ask once for city or ZIP
- After city/ZIP input: proceed immediately
- Any location change triggers a full re-score

## Radius rules
- Local search max: 25 miles
- Never silently expand beyond 25 miles
- If no confirmed local result, ask user to expand nationally

National search behavior:
- Resolve availability + location only
- Do not promise shipping timing or costs
- Fulfillment is handled by the seller/dealer

## Tie handling
- Candidates are tied if composite scores are within ±0.02
- Show 2–3 options max
- Default tie-breaker: closest distance
- Distance only breaks ties if difference > 5 miles

## Clarification rules
- One clarifying question maximum
- Only allowed when score is 0.60–0.79
- No follow-up questions beyond that

## Stop actions (priority order)
When stopping:
1) Expand radius (explicit user control)
2) Watch / Notify
3) Switch resolution mode

## Handoff behavior
- When an answer is confirmed, present:
  - Call (primary)
  - Directions (secondary)
- After handoff, exit immediately

## Voice & interaction constraints
- Spoken response ≤ 12 seconds
- Calm, confident, neutral
- Never salesy
- Never apologetic
- Do not self-introduce unless asked
- Use “confirmed” / “not confirmed”
- Avoid “maybe”, “likely”, “should”

## Logging & privacy
- Log anonymized outcomes only:
  answered / clarified / stopped / handed_off
- Do not store raw queries or audio by default

## Deliverable
Implement all logic under src/ exactly as defined.
engine.ts is the orchestrator.
All other modules must support it without changing behavior.

Do not add commentary. Implement the system.
