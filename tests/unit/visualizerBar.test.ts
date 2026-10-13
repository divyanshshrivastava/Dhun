import { describe, it, expect } from "vitest";
import { CUMULATIVE_DURATIONS } from "../../src/components/VisualizerBar";

describe("VisualizerBar - Timing and Segment Dimensions", () => {
  it("defines the exact 6 cumulative slice timestamps required by the game rules", () => {
    expect(CUMULATIVE_DURATIONS).toEqual([0.1, 0.5, 1.5, 4.0, 8.0, 15.0]);
    expect(CUMULATIVE_DURATIONS.length).toBe(6);
    expect(CUMULATIVE_DURATIONS[5]).toBe(15.0);
  });

  it("verifies cumulative delta calculations add up to 15.0s", () => {
    const deltas = [0.1, 0.4, 1.0, 2.5, 4.0, 7.0];
    const sum = deltas.reduce((acc, d) => acc + d, 0);
    expect(Math.round(sum * 10) / 10).toBe(15.0);

    let cumulative = 0;
    for (let i = 0; i < deltas.length; i++) {
      cumulative += deltas[i];
      expect(Math.round(cumulative * 10) / 10).toBe(CUMULATIVE_DURATIONS[i]);
    }
  });
});
