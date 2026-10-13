import { describe, it, expect } from "vitest";
import { CLIENT_SONG_CATALOG } from "../../src/lib/search/clientCatalog";
import { searchSongCatalog } from "../../src/lib/search/catalogSearch";

describe("Client Song Catalog and Autocomplete indexing", () => {
  it("successfully populates client catalog with all seed songs", () => {
    expect(CLIENT_SONG_CATALOG.length).toBeGreaterThan(50);
    const first = CLIENT_SONG_CATALOG[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("artists");
    expect(first).toHaveProperty("language");
  });

  it("finds songs using Hinglish phonetic matching against CLIENT_SONG_CATALOG", () => {
    const results = searchSongCatalog(CLIENT_SONG_CATALOG, "tum hi ho");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe("Tum Hi Ho");
  });
});
