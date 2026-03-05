import React from "react";

declare global {
  interface GlobalThis {
    CustomElement: { setHeight: (...args: unknown[]) => unknown };
  }
}
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setValueMock = vi.fn();

vi.mock("../../context", () => ({
  useValue: () => [null, setValueMock],
  useIsDisabled: () => false,
}));

vi.mock("@dctx/ui-foundations", () => ({
  Icon: (props: { name: string }) =>
    React.createElement("span", { "data-testid": "icon" }, props.name),
  ICONS: { Home: {}, Search: {}, Settings: {} },
}));

describe("IconPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("CustomElement", { setHeight: setValueMock });
  });

  it("opens the options, filters icons by typing and selects an option", async () => {
    const user = userEvent.setup();

    const { IconPicker } = await import("./IconPicker");

    render(React.createElement(IconPicker));

    const input = screen.getByPlaceholderText(
      "Select an icon...",
    ) as HTMLInputElement;

    await user.click(input);

    expect(screen.getByRole("listbox")).toBeDefined();
    const allOptions = screen.getAllByRole("option");
    expect(allOptions.length).toBe(3);

    await user.type(input, "Sea");
    const filtered = screen.getAllByRole("option");
    expect(filtered.length).toBe(1);
    expect(filtered[0].textContent).toContain("Search");

    await user.click(filtered[0]);

    expect(setValueMock).toHaveBeenCalledWith("Search");

    expect(CustomElement.setHeight).toHaveBeenCalled();
  });
});
