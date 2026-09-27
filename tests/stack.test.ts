import { describe, expect, it } from "vitest";
import { stackFromSurface, type RayHit } from "../src/anatomy/pick";

function hit(id: string, distance: number): RayHit {
  return { id, distance, point: [0, 0, 0] };
}

describe("structures under a tap", () => {
  it("stops at the skin on the far side of the body", () => {
    const layers: Record<string, string> = {
      "skin-front": "skin",
      sternum: "skeleton",
      heart: "organ",
      "muscle-back": "muscle",
      "skin-back": "skin",
    };
    const stack = stackFromSurface(
      [hit("skin-front", 10), hit("sternum", 11), hit("heart", 13), hit("muscle-back", 20), hit("skin-back", 22)],
      (id) => layers[id],
    );
    expect(stack.map((item) => item.id)).toEqual(["skin-front", "sternum", "heart", "muscle-back"]);
  });

  it("does not list a neighboring skin patch as something deeper", () => {
    const stack = stackFromSurface(
      [hit("skin-a", 10), hit("skin-b", 10.4), hit("bone", 12)],
      (id) => (id.startsWith("skin") ? "skin" : "skeleton"),
    );
    expect(stack.map((item) => item.id)).toEqual(["skin-a", "bone"]);
  });
});
