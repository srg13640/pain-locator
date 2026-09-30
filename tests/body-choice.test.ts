import { describe, expect, it } from "vitest";
import { bodyPictureLine, readBodyChoice, skinFileFor, writeBodyChoice } from "../src/lib/bodyChoice";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("body choice", () => {
  it("starts unset, then remembers which outer body to load", () => {
    const store = memoryStore();
    expect(readBodyChoice(store)).toBeNull();
    writeBodyChoice(store, "woman");
    expect(readBodyChoice(store)).toBe("woman");
    expect(skinFileFor("woman")).toBe("skin-female.glb");
    expect(skinFileFor("man")).toBe("skin.glb");
    expect(bodyPictureLine("woman")).toBe("Pictures use a woman's body.");
  });

  it("ignores a stored value that is not a body", () => {
    const store = memoryStore();
    store.setItem("pain-locator-body-v1", "other");
    expect(readBodyChoice(store)).toBeNull();
  });
});
