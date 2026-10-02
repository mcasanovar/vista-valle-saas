import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import type { EditReservationOriginActionResult } from "@/features/admin/edit-reservation-origin-action";
import { EditReservationOriginForm } from "@/features/admin/edit-reservation-origin-form";
import { ToastProvider } from "@/presentation/organisms";

function renderForm(
  props: Readonly<{
    action?: (data: FormData) => Promise<EditReservationOriginActionResult>;
    currentOrigin?: string;
    hasManualNightlyRate?: boolean;
  }> = {}
) {
  const action =
    props.action ??
    vi.fn<(data: FormData) => Promise<EditReservationOriginActionResult>>(
      async () => ({ ok: true as const })
    );
  render(
    <ToastProvider>
      <EditReservationOriginForm
        action={action}
        currentOrigin={props.currentOrigin ?? "admin"}
        hasManualNightlyRate={props.hasManualNightlyRate ?? false}
        reservationId="reservation-1"
      />
    </ToastProvider>
  );
  return { action };
}

describe("origin correction form", () => {
  it("disables the button until a different origin is chosen", async () => {
    const user = userEvent.setup();
    renderForm({ currentOrigin: "admin" });
    const button = screen.getByRole("button", { name: /corregir origen/i });

    expect(button).toBeDisabled();
    await user.selectOptions(
      screen.getByLabelText("Origen de la reserva"),
      "booking"
    );
    expect(button).toBeEnabled();
  });

  it("submits the chosen origin and the reservation id", async () => {
    const user = userEvent.setup();
    const { action } = renderForm({ currentOrigin: "admin" });

    await user.selectOptions(
      screen.getByLabelText("Origen de la reserva"),
      "booking"
    );
    await user.click(screen.getByRole("button", { name: /corregir origen/i }));

    const submitted = (action as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as FormData;
    expect(submitted.get("origin")).toBe("booking");
    expect(submitted.get("id")).toBe("reservation-1");
  });

  describe("warning before dropping a hand-set value", () => {
    it("warns when leaving an external channel with a hand-set value", async () => {
      const user = userEvent.setup();
      renderForm({ currentOrigin: "booking", hasManualNightlyRate: true });

      expect(
        screen.queryByTestId("drop-manual-rate-warning")
      ).not.toBeInTheDocument();

      await user.selectOptions(
        screen.getByLabelText("Origen de la reserva"),
        "admin"
      );
      expect(screen.getByTestId("drop-manual-rate-warning")).toHaveTextContent(
        /el valor\s+fijado a mano se descarta/i
      );
    });

    it.each(["airbnb", "booking"] as const)(
      "does not warn when staying on %s",
      async (origin) => {
        const user = userEvent.setup();
        renderForm({
          currentOrigin: origin === "airbnb" ? "booking" : "airbnb",
          hasManualNightlyRate: true,
        });

        await user.selectOptions(
          screen.getByLabelText("Origen de la reserva"),
          origin
        );
        expect(
          screen.queryByTestId("drop-manual-rate-warning")
        ).not.toBeInTheDocument();
      }
    );

    it("does not warn when there is no hand-set value to drop", async () => {
      const user = userEvent.setup();
      renderForm({ currentOrigin: "booking", hasManualNightlyRate: false });

      await user.selectOptions(
        screen.getByLabelText("Origen de la reserva"),
        "admin"
      );
      expect(
        screen.queryByTestId("drop-manual-rate-warning")
      ).not.toBeInTheDocument();
    });
  });

  describe("warning when relabelling a website reservation", () => {
    it("warns that the payment attribution moves", async () => {
      const user = userEvent.setup();
      renderForm({ currentOrigin: "website" });

      await user.selectOptions(
        screen.getByLabelText("Origen de la reserva"),
        "booking"
      );
      expect(screen.getByTestId("leaves-website-warning")).toHaveTextContent(
        /reatribuye su pago/i
      );
    });

    it("does not warn for a reservation that was not from the website", async () => {
      const user = userEvent.setup();
      renderForm({ currentOrigin: "admin" });

      await user.selectOptions(
        screen.getByLabelText("Origen de la reserva"),
        "booking"
      );
      expect(
        screen.queryByTestId("leaves-website-warning")
      ).not.toBeInTheDocument();
    });
  });
});
