import { describe, it, expect } from "vitest";
import { CUMULATIVE_DURATIONS } from "../../src/components/VisualizerBar";

describe("AudioControls - Duration calculation", () => {
  it("determines correct cumulative audio duration for each attempt index", () => {
    expect(CUMULATIVE_DURATIONS[0]).toBe(0.1);
    expect(CUMULATIVE_DURATIONS[1]).toBe(0.5);
    expect(CUMULATIVE_DURATIONS[2]).toBe(1.5);
    expect(CUMULATIVE_DURATIONS[3]).toBe(4.0);
    expect(CUMULATIVE_DURATIONS[4]).toBe(8.0);
    expect(CUMULATIVE_DURATIONS[5]).toBe(15.0);
  });
});
