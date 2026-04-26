// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/app-header";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AppHeader", () => {
  it("keeps dashboard navigation on the logo and shows only the settings pill", () => {
    const { container } = render(<AppHeader currentPage="dashboard" />);

    const logoLink = screen.getByRole("link", {
      name: /redditpulse/i,
    });
    expect(logoLink).toHaveAttribute("href", "/");
    expect(screen.queryByText(/precision operator desk/i)).toBeNull();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.queryByRole("link", { name: /dashboard/i })).toBeNull();

    const wordmark = container.querySelector(".brand-wordmark");
    expect(wordmark).not.toBeNull();

    const letters = Array.from(
      wordmark?.querySelectorAll<HTMLElement>("[data-letter-index]") ?? [],
    );
    expect(letters).toHaveLength(11);
    expect(
      wordmark?.querySelectorAll('[data-segment="reddit"]'),
    ).toHaveLength(6);

    Object.defineProperty(letters[2], "getBoundingClientRect", {
      value: () => ({
        x: 20,
        y: 0,
        top: 0,
        left: 20,
        right: 30,
        bottom: 24,
        width: 10,
        height: 24,
        toJSON() {
          return this;
        },
      }),
    });

    fireEvent.mouseMove(wordmark as Element, { clientX: 25 });
    expect(letters[2]).toHaveAttribute("data-active", "true");

    fireEvent.mouseLeave(wordmark as Element);
    expect(letters.every((letter) => letter.getAttribute("data-active") === "false")).toBe(
      true,
    );

    const navigation = screen.getByRole("navigation");
    expect(within(navigation).getAllByRole("link")).toHaveLength(1);
  });
});
