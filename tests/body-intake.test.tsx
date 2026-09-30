// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { BodyIntake } from "../src/components/BodyIntake";
import type { BodyChoice } from "../src/lib/bodyChoice";

function Harness() {
  const [choice, setChoice] = useState<BodyChoice | null>(null);
  return (
    <div>
      <p data-testid="choice">{choice ?? "unset"}</p>
      <BodyIntake open={choice === null} changing={false} onChoose={setChoice} />
    </div>
  );
}

describe("body intake", () => {
  it("asks which body to show and loads that choice", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "Which body should this use?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "A woman's body" }));
    expect(screen.getByTestId("choice").textContent).toBe("woman");
    expect(screen.queryByRole("heading", { name: "Which body should this use?" })).toBeNull();
  });
});
