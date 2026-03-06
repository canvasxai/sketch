import { describe, expect, it } from "vitest";
import { parseAllowedSkills } from "./skill-permissions";

describe("parseAllowedSkills", () => {
  it("returns null for null input", () => {
    expect(parseAllowedSkills(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseAllowedSkills(undefined)).toBeNull();
  });

  it("parses a valid JSON array of strings", () => {
    expect(parseAllowedSkills('["canvas","crm"]')).toEqual(["canvas", "crm"]);
  });

  it("parses an empty JSON array", () => {
    expect(parseAllowedSkills("[]")).toEqual([]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseAllowedSkills("not json")).toBeNull();
  });

  it("returns null for a JSON object (not array)", () => {
    expect(parseAllowedSkills('{"a":1}')).toBeNull();
  });

  it("returns null for a JSON string (not array)", () => {
    expect(parseAllowedSkills('"canvas"')).toBeNull();
  });

  it("filters out non-string elements from array", () => {
    expect(parseAllowedSkills('["canvas", 42, null, "crm", true]')).toEqual(["canvas", "crm"]);
  });

  it("returns empty array when all elements are non-string", () => {
    expect(parseAllowedSkills("[1, 2, 3]")).toEqual([]);
  });
});
