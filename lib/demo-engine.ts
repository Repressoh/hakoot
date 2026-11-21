import { DEMO_BOTS, type DemoLesson, type DemoStep } from "./demo-lesson";

export type DemoSessionStatus = "waiting" | "in_progress" | "finished";

export interface DemoParticipantAnswer {
  choiceIndex: number;
  isCorrect: boolean;
  points: number;
  stepId: string;
}

export interface DemoParticipant {
  answers: Record<string, DemoParticipantAnswer>;
  id: string;
  isBot: boolean;
  name: string;
  totalScore: number;
}

export interface DemoSessionState {
  answerRevealed: boolean;
  currentStepIndex: number;
  participants: DemoParticipant[];
  status: DemoSessionStatus;
  stepStartedAt: number | null;
}

export interface DemoLeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  totalScore: number;
}

export const DEMO_VISITOR_ID = "visitor";

/** Speed-based points matching Hakoot's live quiz scoring (500–1000 for correct answers). */
export function calculateDemoPoints(
  isCorrect: boolean,
  elapsedMs: number,
  timeLimitSeconds: number
): number {
  if (!isCorrect) {
    return 0;
  }
  if (timeLimitSeconds <= 0) {
    return 1000;
  }
  const limitMs = timeLimitSeconds * 1000;
  const remainingRatio = Math.max(
    0,
    Math.min(1, (limitMs - elapsedMs) / limitMs)
  );
  return 500 + Math.round(500 * remainingRatio);
}

/** Creates a fresh open-day demo session in the lobby state. */
export function createInitialDemoState(visitorName: string): DemoSessionState {
  const cleanName = visitorName.trim() || "Guest";
  return {
    answerRevealed: false,
    currentStepIndex: 0,
    participants: [
      {
        answers: {},
        id: DEMO_VISITOR_ID,
        isBot: false,
        name: cleanName,
        totalScore: 0,
      },
      ...DEMO_BOTS.map((bot) => ({
        answers: {},
        id: bot.id,
        isBot: true,
        name: bot.name,
        totalScore: 0,
      })),
    ],
    status: "waiting",
    stepStartedAt: null,
  };
}

/** Updates the visitor's display name in the lobby. */
export function renameDemoVisitor(
  state: DemoSessionState,
  name: string
): DemoSessionState {
  const trimmed = name.slice(0, 32);
  return {
    ...state,
    participants: state.participants.map((p) =>
      p.id === DEMO_VISITOR_ID ? { ...p, name: trimmed } : p
    ),
  };
}

/** Transitions the demo session from waiting lobby to the first step. */
export function startDemoSession(
  state: DemoSessionState,
  now: number
): DemoSessionState {
  if (state.status !== "waiting") {
    return state;
  }
  return {
    ...state,
    answerRevealed: false,
    currentStepIndex: 0,
    participants: state.participants.map((p) =>
      p.id === DEMO_VISITOR_ID && !p.name.trim() ? { ...p, name: "Guest" } : p
    ),
    status: "in_progress",
    stepStartedAt: now,
  };
}

/** Returns true when the current timed quiz step has reached or passed its deadline. */
export function isDemoStepExpired(
  state: DemoSessionState,
  lesson: DemoLesson,
  now: number
): boolean {
  if (state.status !== "in_progress" || state.stepStartedAt === null) {
    return false;
  }
  const step = lesson.steps[state.currentStepIndex];
  if (step?.type !== "quiz" || step.timeLimitSeconds <= 0) {
    return false;
  }
  return now - state.stepStartedAt >= step.timeLimitSeconds * 1000;
}

/** Records a participant's answer for the current quiz step (idempotent per step). */
export function submitDemoAnswer(
  state: DemoSessionState,
  lesson: DemoLesson,
  participantId: string,
  choiceIndex: number,
  now: number
): DemoSessionState {
  if (state.status !== "in_progress" || state.answerRevealed) {
    return state;
  }
  const step = lesson.steps[state.currentStepIndex];
  if (step?.type !== "quiz") {
    return state;
  }
  if (isDemoStepExpired(state, lesson, now)) {
    return state;
  }
  const choice = step.choices[choiceIndex];
  if (!choice) {
    return state;
  }

  let changed = false;
  const elapsedMs = Math.max(0, now - (state.stepStartedAt ?? now));
  const points = calculateDemoPoints(
    choice.isCorrect,
    elapsedMs,
    step.timeLimitSeconds
  );

  const participants = state.participants.map((participant) => {
    if (participant.id !== participantId || participant.answers[step.id]) {
      return participant;
    }
    changed = true;
    return {
      ...participant,
      answers: {
        ...participant.answers,
        [step.id]: {
          choiceIndex,
          isCorrect: choice.isCorrect,
          points,
          stepId: step.id,
        },
      },
    };
  });

  return changed ? { ...state, participants } : state;
}

/** Reveals the correct answer and credits this step's points to the leaderboard once. */
export function revealDemoAnswer(
  state: DemoSessionState,
  lesson: DemoLesson
): DemoSessionState {
  if (state.status !== "in_progress" || state.answerRevealed) {
    return state;
  }
  const step = lesson.steps[state.currentStepIndex];
  if (step?.type !== "quiz") {
    return state;
  }
  const participants = state.participants.map((participant) => {
    const answer = participant.answers[step.id];
    if (!answer) {
      return participant;
    }
    return {
      ...participant,
      totalScore: participant.totalScore + answer.points,
    };
  });
  return {
    ...state,
    answerRevealed: true,
    participants,
  };
}

/** Advances to the next step, or finishes the session after the last step. */
export function advanceDemoStep(
  state: DemoSessionState,
  lesson: DemoLesson,
  now: number
): DemoSessionState {
  if (state.status !== "in_progress") {
    return state;
  }
  const step = lesson.steps[state.currentStepIndex];
  if (step?.type === "quiz" && !state.answerRevealed) {
    return state;
  }
  const nextIndex = state.currentStepIndex + 1;
  if (nextIndex >= lesson.steps.length) {
    return {
      ...state,
      answerRevealed: false,
      status: "finished",
      stepStartedAt: null,
    };
  }
  return {
    ...state,
    answerRevealed: false,
    currentStepIndex: nextIndex,
    stepStartedAt: now,
  };
}

/** Returns the current step when in progress, or null otherwise. */
export function getCurrentDemoStep(
  state: DemoSessionState,
  lesson: DemoLesson
): DemoStep | null {
  if (state.status !== "in_progress") {
    return null;
  }
  return lesson.steps[state.currentStepIndex] ?? null;
}

/** Counts how many participants have answered the given quiz step. */
export function getStepAnswerCount(
  state: DemoSessionState,
  stepId: string
): number {
  let count = 0;
  for (const participant of state.participants) {
    if (participant.answers[stepId]) {
      count += 1;
    }
  }
  return count;
}

/** Computes the ranked leaderboard sorted by score descending, then name. */
export function getDemoLeaderboard(
  state: DemoSessionState
): DemoLeaderboardEntry[] {
  const sorted = [...state.participants].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((participant, index) => ({
    id: participant.id,
    name: participant.name,
    rank: index + 1,
    totalScore: participant.totalScore,
  }));
}
