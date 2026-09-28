import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else if (/\.(ts|tsx|mjs|css|html)$/.test(name)) found.push(full);
  }
  return found;
}

describe("offline rule", () => {
  it("has no web addresses in the app code or the local server", () => {
    const paths = [...filesUnder(path.join(ROOT, "src")), ...filesUnder(path.join(ROOT, "server"))];
    const hits: string[] = [];
    for (const file of paths) {
      const text = readFileSync(file, "utf8");
      const urls = text.match(/https?:\/\/[^\s"'`)>]+/g) ?? [];
      const outside = urls.filter((url) => !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url));
      if (outside.length > 0) hits.push(`${path.relative(ROOT, file)}: ${outside.join(", ")}`);
    }
    expect(hits).toEqual([]);
  });
});
