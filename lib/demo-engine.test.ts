import { describe, expect, it } from "vitest";
import {
  advanceDemoStep,
  calculateDemoPoints,
  createInitialDemoState,
  DEMO_VISITOR_ID,
  getCurrentDemoStep,
  getDemoLeaderboard,
  getStepAnswerCount,
  isDemoStepExpired,
  renameDemoVisitor,
  revealDemoAnswer,
  startDemoSession,
  submitDemoAnswer,
} from "./demo-engine";
import { DEMO_BOTS, getDemoLesson } from "./demo-lesson";

describe("demo-engine", () => {
  const lesson = getDemoLesson("en");

  it("returns localized lessons for English and Italian", () => {
    const en = getDemoLesson("en");
    const itLesson = getDemoLesson("it");
    expect(en.steps).toHaveLength(4);
    expect(itLesson.steps).toHaveLength(4);
    expect(en.title).not.toBe(itLesson.title);
  });

  it("calculates speed-based points accurately", () => {
    expect(calculateDemoPoints(false, 1000, 20)).toBe(0);
    expect(calculateDemoPoints(true, 0, 20)).toBe(1000);
    expect(calculateDemoPoints(true, 10_000, 20)).toBe(750);
    expect(calculateDemoPoints(true, 25_000, 20)).toBe(500);
  });

  it("initializes lobby with visitor and simulated classmates", () => {
    const state = createInitialDemoState("  Giulia  ");
    expect(state.status).toBe("waiting");
    expect(state.participants).toHaveLength(1 + DEMO_BOTS.length);
    expect(state.participants[0]?.name).toBe("Giulia");
    expect(getCurrentDemoStep(state, lesson)).toBeNull();
  });

  it("runs a full session from lobby through theory, quiz, reveal, leaderboard, and finish", () => {
    let state = createInitialDemoState("Marco");
    state = renameDemoVisitor(state, "Elena");
    expect(state.participants[0]?.name).toBe("Elena");

    // Start -> Step 0 (theory)
    state = startDemoSession(state, 1000);
    expect(state.status).toBe("in_progress");
    expect(getCurrentDemoStep(state, lesson)?.type).toBe("theory");

    // Advance -> Step 1 (quiz-1)
    state = advanceDemoStep(state, lesson, 2000);
    const quiz1 = getCurrentDemoStep(state, lesson);
    expect(quiz1?.type).toBe("quiz");
    expect(quiz1?.id).toBe("quiz-1");

    // Cannot advance past quiz before revealing answer
    expect(advanceDemoStep(state, lesson, 3000).currentStepIndex).toBe(1);

    // Visitor answers correctly in 4s (80% remaining -> 900 pts), withheld until reveal
    state = submitDemoAnswer(state, lesson, DEMO_VISITOR_ID, 0, 6000);
    expect(getStepAnswerCount(state, "quiz-1")).toBe(1);
    expect(state.participants[0]?.totalScore).toBe(0);

    // Duplicate answer is ignored
    state = submitDemoAnswer(state, lesson, DEMO_VISITOR_ID, 1, 7000);
    expect(state.participants[0]?.answers["quiz-1"]?.points).toBe(900);

    // Bot answers wrong -> 0 pts
    state = submitDemoAnswer(state, lesson, "bot-sam", 1, 6100);
    expect(getStepAnswerCount(state, "quiz-1")).toBe(2);

    // Reveal answer -> credits points once and ranks Elena first
    state = revealDemoAnswer(state, lesson);
    expect(state.answerRevealed).toBe(true);
    expect(state.participants[0]?.totalScore).toBe(900);
    // Repeated reveal is idempotent and does not double-award
    state = revealDemoAnswer(state, lesson);
    expect(state.participants[0]?.totalScore).toBe(900);
    const board = getDemoLeaderboard(state);
    expect(board[0]?.name).toBe("Elena");
    expect(board[0]?.rank).toBe(1);

    // Advance -> Step 2 (theory-2) -> Step 3 (quiz-2) -> Reveal -> Finish
    state = advanceDemoStep(state, lesson, 10_000);
    expect(getCurrentDemoStep(state, lesson)?.id).toBe("theory-2");

    state = advanceDemoStep(state, lesson, 15_000);
    expect(getCurrentDemoStep(state, lesson)?.id).toBe("quiz-2");

    state = submitDemoAnswer(state, lesson, DEMO_VISITOR_ID, 0, 17_000);
    expect(state.participants[0]?.totalScore).toBe(900);
    state = revealDemoAnswer(state, lesson);
    expect(state.participants[0]?.totalScore).toBe(1850);
    state = advanceDemoStep(state, lesson, 20_000);
    expect(state.status).toBe("finished");
    expect(getCurrentDemoStep(state, lesson)).toBeNull();
  });

  it("rejects quiz submissions at or after the step deadline", () => {
    let state = createInitialDemoState("Luca");
    state = startDemoSession(state, 1000);
    state = advanceDemoStep(state, lesson, 2000);

    expect(isDemoStepExpired(state, lesson, 21_999)).toBe(false);
    expect(isDemoStepExpired(state, lesson, 22_000)).toBe(true);

    // Submitting at or past the 20s deadline is ignored
    const afterLate = submitDemoAnswer(
      state,
      lesson,
      DEMO_VISITOR_ID,
      0,
      22_000
    );
    expect(afterLate).toBe(state);
    expect(getStepAnswerCount(afterLate, "quiz-1")).toBe(0);

    // Manual host reveal still works and awards 0 points for unanswered visitor
    const revealed = revealDemoAnswer(afterLate, lesson);
    expect(revealed.answerRevealed).toBe(true);
    expect(revealed.participants[0]?.totalScore).toBe(0);
  });
});
