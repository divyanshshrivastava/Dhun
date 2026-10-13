import { describe, it, expect } from "vitest";

describe("Modals - Emoji Share formatting and Statistics data structures", () => {
  it("formats standard emoji grid correctly", () => {
    const guesses = [
      { attemptIndex: 0, action: "SKIP" as const, isCorrect: false },
      { attemptIndex: 1, action: "GUESS" as const, isCorrect: false },
      { attemptIndex: 2, action: "GUESS" as const, isCorrect: true },
    ];

    const row = guesses
      .map((g) => {
        if (g.isCorrect) return "🟩";
        if (g.action === "SKIP") return "⬛";
        return "🟥";
      })
      .join("");

    expect(row).toBe("⬛🟥🟩");
  });

  it("calculates win percentage accurately", () => {
    const calcWinRate = (won: number, played: number) =>
      played > 0 ? Math.round((won / played) * 100) : 0;

    expect(calcWinRate(0, 0)).toBe(0);
    expect(calcWinRate(5, 10)).toBe(50);
    expect(calcWinRate(7, 9)).toBe(78);
  });
});
