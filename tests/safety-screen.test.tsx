// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SafetyGate } from "../src/components/SafetyGate";
import { canPlacePin, initialSafety, type SafetyState } from "../src/lib/safety";

function Harness() {
  const [state, setState] = useState<SafetyState>(initialSafety());
  return (
    <div>
      <p data-testid="gate">{canPlacePin(state) ? "open" : "closed"}</p>
      <SafetyGate state={state} open onChange={setState} onLookFirst={() => undefined} />
    </div>
  );
}

describe("safety screen", () => {
  it("shows the warning list and refuses to continue into pinning when any box is checked until 911 is acknowledged", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("Crushing or squeezing pressure in the chest")).toBeTruthy();
    expect(screen.getByTestId("gate").textContent).toBe("closed");
    await user.click(screen.getByLabelText("Shortness of breath"));
    await user.click(screen.getByRole("button", { name: "One of these is happening" }));
    expect(screen.getByText("Call 911 now.")).toBeTruthy();
    expect(screen.getByTestId("gate").textContent).toBe("closed");
    await user.click(screen.getByRole("button", { name: "I understand. I will call 911." }));
    expect(screen.getByTestId("gate").textContent).toBe("open");
  });
});
