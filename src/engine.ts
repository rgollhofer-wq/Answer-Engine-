// AE v0 Engine Orchestrator
// Implemented strictly per spec/answer-engine-v0.md
// and blueprint/implementation.md

export type SourceType = "provider" | "feed" | "public";

export type OutcomeType =
  | "answer"
  | "clarify"
  | "ask_location"
  | "stop"
  | "handoff";

export interface EngineLocation {
  status: "resolved" | "denied" | "unclear";
  cityZip?: string;
}

export interface EngineState {
  clarificationAsked?: boolean;
  locationAsked?: boolean;
  lastLocation?: string;
  mode?: "local" | "national";
}

export interface Candidate {
  id: string;
  name: string;
  source: SourceType;
  authority: number;
  agreement: number;
  freshness: number;
  distanceMiles?: number;
  availability?: string;
  openNow?: boolean | null;
  locationLabel?: string;
}

export interface EngineInput {
  intent: string;
  location?: EngineLocation;
  locationInput?: string;
  clarificationAnswer?: string;
  candidates?: {
    provider?: Candidate[];
    feed?: Candidate[];
    public?: Candidate[];
  };
  state?: EngineState;
  allowNational?: boolean;
}

export interface EngineResponse {
  type: OutcomeType;
  message: string;
  state: EngineState;
  candidate?: Candidate;
  options?: Candidate[];
  actions?: string[];
}

const LOCATION_FALLBACK_QUESTION =
  "I don’t have your location. What city or ZIP should I search near?";

const MAX_LOCAL_RADIUS_MILES = 25;
const TIE_SCORE_DELTA = 0.02;
const DISTANCE_TIE_BREAK_MILES = 5;

function clamp(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function computeScore(candidate: Candidate): number {
  return (
    0.5 * clamp(candidate.authority) +
    0.3 * clamp(candidate.agreement) +
    0.2 * clamp(candidate.freshness)
  );
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function resolveLocation(
  input: EngineInput,
  state: EngineState
): { resolvedLocation?: string; askLocation?: boolean; state: EngineState } {
  if (input.location?.status === "resolved" && input.location.cityZip) {
    return {
      resolvedLocation: input.location.cityZip,
      state: {
        ...state,
        lastLocation: input.location.cityZip,
        mode: state.mode ?? "local",
      },
    };
  }

  if (input.locationInput) {
    return {
      resolvedLocation: input.locationInput,
      state: {
        ...state,
        locationAsked: true,
        lastLocation: input.locationInput,
        mode: state.mode ?? "local",
      },
    };
  }

  if (!state.locationAsked) {
    return {
      askLocation: true,
      state: { ...state, locationAsked: true },
    };
  }

  return {
    resolvedLocation: state.lastLocation,
    state,
  };
}

function collectCandidates(
  candidates?: EngineInput["candidates"]
): Candidate[] {
  return [
    ...(candidates?.provider ?? []),
    ...(candidates?.feed ?? []),
    ...(candidates?.public ?? []),
  ];
}

function filterLocalCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.filter(
    (c) => c.distanceMiles == null || c.distanceMiles <= MAX_LOCAL_RADIUS_MILES
  );
}

function narrowByClarification(
  candidates: Candidate[],
  clarificationAnswer: string
): Candidate[] {
  const answer = normalize(clarificationAnswer);
  return candidates.filter((c) => {
    const id = normalize(c.id);
    const name = normalize(c.name);
    return (
      id === answer ||
      name === answer ||
      name.includes(answer) ||
      answer.includes(name)
    );
  });
}

function sortCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    const diff = computeScore(b) - computeScore(a);
    if (diff !== 0) return diff;
    return (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity);
  });
}

function resolveTie(sorted: Candidate[]): {
  primary?: Candidate;
  tied: Candidate[];
} {
  if (sorted.length === 0) return { tied: [] };

  const topScore = computeScore(sorted[0]);
  const tied = sorted.filter(
    (c) => Math.abs(computeScore(c) - topScore) <= TIE_SCORE_DELTA
  );

  if (tied.length <= 1) return { primary: sorted[0], tied };

  const byDistance = [...tied].sort(
    (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity)
  );

  const delta =
    (byDistance.at(-1)?.distanceMiles ?? 0) -
    (byDistance[0]?.distanceMiles ?? 0);

  if (delta > DISTANCE_TIE_BREAK_MILES) {
    return { primary: byDistance[0], tied };
  }

  return { tied };
}

function buildClarificationQuestion(options: Candidate[]): string {
  return `Which one do you mean: ${options
    .slice(0, 3)
    .map((c) => c.name)
    .join(" or ")}?`;
}

function buildAnswerMessage(
  candidate: Candidate,
  resolvedLocation: string
): string {
  return `Confirmed: ${candidate.name} has ${candidate.availability} in ${resolvedLocation}. It is open now.`;
}

function stopMessage(): string {
  return "Not confirmed. Next actions: expand radius, watch/notify, or switch resolution mode.";
}

function hasConfirmedScope(
  candidate: Candidate,
  resolvedLocation?: string
): boolean {
  return !!(
    resolvedLocation &&
    candidate.availability &&
    candidate.openNow === true
  );
}

export function runEngine(input: EngineInput): EngineResponse {
  const state: EngineState = {
    clarificationAsked: input.state?.clarificationAsked ?? false,
    locationAsked: input.state?.locationAsked ?? false,
    lastLocation: input.state?.lastLocation,
    mode: input.state?.mode ?? "local",
  };

  const locationResult = resolveLocation(input, state);
  if (locationResult.askLocation) {
    return {
      type: "ask_location",
      message: LOCATION_FALLBACK_QUESTION,
      state: locationResult.state,
    };
  }

  const resolvedLocation =
    locationResult.resolvedLocation ?? state.lastLocation;
  if (!resolvedLocation) {
    return {
      type: "stop",
      message: stopMessage(),
      actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
      state: locationResult.state,
    };
  }

  const locationChanged =
    state.lastLocation && resolvedLocation !== state.lastLocation;

  const nextState: EngineState = {
    ...locationResult.state,
    lastLocation: resolvedLocation,
    mode: input.allowNational ? "national" : state.mode ?? "local",
  };

  let candidatesList = collectCandidates(input.candidates);
  if (nextState.mode !== "national") {
    candidatesList = filterLocalCandidates(candidatesList);
  }

  if (state.clarificationAsked && input.clarificationAnswer) {
    candidatesList = narrowByClarification(
      candidatesList,
      input.clarificationAnswer
    );
  }

  if (candidatesList.length === 0) {
    return {
      type: "stop",
      message: stopMessage(),
      actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
      state: nextState,
    };
  }

  if (locationChanged) {
    candidatesList = sortCandidates(candidatesList);
  }

  const sorted = sortCandidates(candidatesList);
  const topScore = computeScore(sorted[0]);
  const { primary, tied } = resolveTie(sorted);
  const tieOptions = tied.slice(0, 3);

  if (state.clarificationAsked && input.clarificationAnswer) {
    if (
      primary &&
      topScore >= 0.8 &&
      hasConfirmedScope(primary, resolvedLocation)
    ) {
      return {
        type: "answer",
        message: buildAnswerMessage(primary, resolvedLocation),
        candidate: primary,
        actions: ["call", "directions"],
        state: nextState,
      };
    }

    return {
      type: "stop",
      message: stopMessage(),
      actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
      state: nextState,
    };
  }

  if (topScore >= 0.8) {
    if (!primary || !hasConfirmedScope(primary, resolvedLocation)) {
      return {
        type: "stop",
        message: stopMessage(),
        actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
        state: nextState,
      };
    }

    return {
      type: "answer",
      message: buildAnswerMessage(primary, resolvedLocation),
      candidate: primary,
      actions: ["call", "directions"],
      state: nextState,
    };
  }

  if (topScore >= 0.6) {
    if (state.clarificationAsked) {
      return {
        type: "stop",
        message: stopMessage(),
        actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
        state: nextState,
      };
    }

    return {
      type: "clarify",
      message: buildClarificationQuestion(tieOptions),
      options: tieOptions,
      state: { ...nextState, clarificationAsked: true },
    };
  }

  return {
    type: "stop",
    message: stopMessage(),
    actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
    state: nextState,
  };
}
