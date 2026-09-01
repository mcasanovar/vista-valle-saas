import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompanyQuotationConfirmationModal } from "@/presentation/organisms";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("CompanyQuotationConfirmationModal", () => {
  it("focuses the close button on open and shows no amounts or room detail", () => {
    render(<CompanyQuotationConfirmationModal />);

    const dialog = screen.getByRole("dialog", { name: "Cotización enviada" });
    expect(dialog).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cerrar" })
    ).toHaveFocus();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("closes and redirects to the landing page when the close button is activated", async () => {
    push.mockClear();
    const user = userEvent.setup();
    render(<CompanyQuotationConfirmationModal />);

    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closes and redirects when the backdrop is clicked, but not when the dialog content is clicked", async () => {
    push.mockClear();
    const user = userEvent.setup();
    render(<CompanyQuotationConfirmationModal />);

    await user.click(screen.getByRole("dialog"));
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("dialog").parentElement!);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closes and redirects when Escape is pressed", async () => {
    push.mockClear();
    const user = userEvent.setup();
    render(<CompanyQuotationConfirmationModal />);

    await user.keyboard("{Escape}");

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/");
  });

  it("closes and redirects automatically after 5 seconds", () => {
    push.mockClear();
    vi.useFakeTimers();
    try {
      render(<CompanyQuotationConfirmationModal />);
      expect(push).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a visible countdown that updates every second until it closes", () => {
    push.mockClear();
    vi.useFakeTimers();
    try {
      render(<CompanyQuotationConfirmationModal />);
      expect(screen.getByText(/se cerrará automáticamente en 5 segundos/)).toBeVisible();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(
        screen.getByText(/se cerrará automáticamente en 4 segundos/)
      ).toBeVisible();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(
        screen.getByText(/se cerrará automáticamente en 3 segundos/)
      ).toBeVisible();

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(
        screen.getByText(/se cerrará automáticamente en 1 segundo\./)
      ).toBeVisible();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not redirect a second time from the timer after an earlier manual close", () => {
    push.mockClear();
    vi.useFakeTimers();
    try {
      render(<CompanyQuotationConfirmationModal />);

      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(push).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
