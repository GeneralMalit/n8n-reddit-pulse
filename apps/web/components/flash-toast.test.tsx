// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlashToast } from "@/components/flash-toast";

describe("FlashToast", () => {
  it("renders as a popup notification and auto dismisses after 3 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <FlashToast
        flash={{ tone: "success", message: "Removed r/mildlyinfuriating." }}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText("Removed r/mildlyinfuriating."),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
