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

function computeScore(candidate: Candidate): number {
  const authority = clamp(candidate.authority);
  const agreement = clamp(candidate.agreement);
  const freshness = clamp(candidate.freshness);
  return 0.5 * authority + 0.3 * agreement + 0.2 * freshness;
}

function clamp(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
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
      state: {
        ...state,
        locationAsked: true,
      },
    };
  }

  return {
  resolvedLocation: state.lastLocation,
  state,
};

function collectCandidates(
  candidates?: EngineInput["candidates"]
): Candidate[] {
  const provider = candidates?.provider ?? [];
  const feed = candidates?.feed ?? [];
  const publicListings = candidates?.public ?? [];
  return [...provider, ...feed, ...publicListings];
}

}

function filterLocalCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.filter((candidate) => {
    if (candidate.distanceMiles === undefined || candidate.distanceMiles === null) {
      return true;
    }
    return candidate.distanceMiles <= MAX_LOCAL_RADIUS_MILES;
  });
}

function narrowByClarification(
  candidates: Candidate[],
  clarificationAnswer: string
): Candidate[] {
  const answer = normalize(clarificationAnswer);
  return candidates.filter((candidate) => {
    const id = normalize(candidate.id);
    const name = normalize(candidate.name);
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
    const scoreA = computeScore(a);
    const scoreB = computeScore(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    const distanceA = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const distanceB = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });
}

function resolveTie(sorted: Candidate[]): { primary?: Candidate; tied: Candidate[] } {
  if (sorted.length === 0) {
    return { tied: [] };
  }
  const topScore = computeScore(sorted[0]);
  const tied = sorted.filter(
    (candidate) => Math.abs(computeScore(candidate) - topScore) <= TIE_SCORE_DELTA
  );
  if (tied.length <= 1) {
    return { primary: sorted[0], tied };
  }

  const sortedByDistance = [...tied].sort((a, b) => {
    const distanceA = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const distanceB = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    return distanceA - distanceB;
  });

  const closest = sortedByDistance[0];
  const farthest = sortedByDistance[sortedByDistance.length - 1];
  const distanceA = closest.distanceMiles ?? 0;
  const distanceB = farthest.distanceMiles ?? 0;

  if (distanceB - distanceA > DISTANCE_TIE_BREAK_MILES) {
    return { primary: closest, tied };
  }

  return { tied };
}

function buildClarificationQuestion(options: Candidate[]): string {
  const names = options.slice(0, 3).map((candidate) => candidate.name);
  return `Which one do you mean: ${names.join(" or ")}?`;
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

function hasConfirmedScope(candidate: Candidate, resolvedLocation?: string): boolean {
  if (!resolvedLocation) {
    return false;
  }
  if (!candidate.availability) {
    return false;
  }
  return candidate.openNow === true;
}

export function runEngine(input: EngineInput): EngineResponse {
  const state: EngineState = {
    clarificationAsked: input.state?.clarificationAsked ?? false,
    locationAsked: input.state?.locationAsked ?? false,
    lastLocation: input.state?.lastLocation,
    mode: input.state?.mode ?? "local",
  };
  // Normalize candidate buckets so the engine can reason safely
  const candidates = input.candidates ?? {};
  const provider = candidates.provider ?? [];
  const feed = candidates.feed ?? [];
  const publicCands = candidates.public ?? [];
  const locationResult = resolveLocation(input, state);
  if (locationResult.askLocation) {
    return {
      type: "ask_location",
      message: LOCATION_FALLBACK_QUESTION,
      state: locationResult.state,
    };
  }

  const resolvedLocation = locationResult.resolvedLocation ?? state.lastLocation;
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
    mode: input.allowNational ? "national" : locationResult.state.mode ?? "local",
  };

  let candidates = collectCandidates(input);
  if (nextState.mode !== "national") {
    candidates = filterLocalCandidates(candidates);
  }

  if (state.clarificationAsked && input.clarificationAnswer) {
    candidates = narrowByClarification(candidates, input.clarificationAnswer);
  }

  if (candidates.length === 0) {
    return {
      type: "stop",
      message: stopMessage(),
      actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
      state: nextState,
    };
  }

  if (locationChanged) {
    candidates = sortCandidates(candidates);
  }

  const sorted = sortCandidates(candidates);
  const topScore = computeScore(sorted[0]);
  const { primary, tied } = resolveTie(sorted);
  const tieOptions = tied.slice(0, 3);

  if (state.clarificationAsked && input.clarificationAnswer) {
    if (primary && topScore >= 0.8 && hasConfirmedScope(primary, resolvedLocation)) {
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
    if (!primary) {
      return {
        type: "stop",
        message: stopMessage(),
        actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
        state: nextState,
      };
    }

    if (!hasConfirmedScope(primary, resolvedLocation)) {
      return {
        type: "stop",
        message: stopMessage(),
        actions: ["expand_radius", "watch_notify", "switch_resolution_mode"],
        state: nextState,
      };
    }

    if (tied.length > 1 && !primary) {
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

  if (topScore >= 0.6 && topScore < 0.8) {
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
