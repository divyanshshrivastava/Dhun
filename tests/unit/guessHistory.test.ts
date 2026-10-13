import { describe, it, expect } from "vitest";
import { GuessRecord } from "../../src/components/GuessHistory";

describe("GuessHistory data model and slot generation", () => {
  it("processes a sequence of mixed guesses and skips", () => {
    const guesses: GuessRecord[] = [
      { attemptIndex: 0, action: "SKIP", isCorrect: false },
      { attemptIndex: 1, action: "GUESS", isCorrect: false, guessedSongTitle: "Aankh Marey" },
      { attemptIndex: 2, action: "GUESS", isCorrect: true, guessedSongTitle: "Kal Ho Naa Ho" },
    ];

    expect(guesses.length).toBe(3);
    expect(guesses[0].action).toBe("SKIP");
    expect(guesses[1].isCorrect).toBe(false);
    expect(guesses[2].isCorrect).toBe(true);
  });
});
