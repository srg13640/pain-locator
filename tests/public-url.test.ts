import { describe, expect, it } from "vitest";
import { publicUrl } from "../src/lib/publicUrl";

describe("public paths", () => {
  it("keeps the Mac address at the root of this computer", () => {
    expect(publicUrl("anatomy/catalog.json", "/")).toBe("/anatomy/catalog.json");
    expect(publicUrl("/api/entries", "/")).toBe("/api/entries");
  });

  it("puts the same files under the shared-site folder", () => {
    expect(publicUrl("anatomy/skeleton.glb", "/pain-locator/")).toBe("/pain-locator/anatomy/skeleton.glb");
    expect(publicUrl("/api/entries", "/pain-locator")).toBe("/pain-locator/api/entries");
  });
});
