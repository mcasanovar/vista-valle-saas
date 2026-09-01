import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookingSummaryController } from "@/features/reservations";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("BookingSummaryController", () => {
  it("shows server summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          room: { name: "Habitación Valle" },
          checkIn: "2026-10-05",
          checkOut: "2026-10-08",
          guestCount: 2,
          pricing: {
            nights: 3,
            nightlyPriceClp: 55000,
            chargesClp: 0,
            totalClp: 165000,
          },
        }),
      })
    );
    render(<BookingSummaryController />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Ver resumen" }));
    expect(await screen.findByText("Habitación Valle")).toBeVisible();
  });
});
