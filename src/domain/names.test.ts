import { describe, expect, it } from "vitest";
import { matchName } from "./names";

const people = [{ name: "Budi Santoso" }, { name: "Budiman" }, { name: "Rani" }, { name: "Ádi" }];
const by = (p: { name: string }) => p.name;

describe("matchName", () => {
  it("prefers an exact match", () => {
    expect(matchName(people, "rani", by)).toEqual({ found: people[2] });
  });
  it("asks when a prefix fits several people", () => {
    expect(matchName(people, "budi", by)).toEqual({
      found: null,
      candidates: [people[0], people[1]],
    });
  });
  it("finds a unique substring and ignores accents", () => {
    expect(matchName(people, "santoso", by)).toEqual({ found: people[0] });
    expect(matchName(people, "adi", by)).toEqual({ found: people[3] });
  });
  it("reports no candidates when nothing fits", () => {
    expect(matchName(people, "zaki", by)).toEqual({ found: null, candidates: [] });
  });
});
