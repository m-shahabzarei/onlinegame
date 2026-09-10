import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("exposes its visible label as the accessible name", () => {
    render(<Button>Save foundation</Button>);

    expect(
      screen.getByRole("button", { name: "Save foundation" }),
    ).toBeEnabled();
  });

  it("uses disabled and busy semantics while loading", () => {
    render(
      <Button loading loadingText="Saving">
        Save foundation
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(within(button).getByTestId("button-spinner")).toBeVisible();
  });
});
