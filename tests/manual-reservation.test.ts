import { describe, it, expect } from "vitest";
import {
  createManualReservation,
  manualOrigins,
} from "@/features/admin/manual-reservation";
import { confirmPayAtPropertyBooking } from "@/features/reservations/confirm-pay-at-property";
const guest = {
  room: "demo-room-andes",
  checkIn: "2027-02-01",
  checkOut: "2027-02-03",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "123",
  guestCount: "1",
};
describe("manual reservation", () => {
  it("uses authoritative capacity and price for every origin", async () => {
    for (const [i, origin] of manualOrigins.entries()) {
      const result = await createManualReservation(
        {
          ...guest,
          origin,
          checkIn: `2027-0${i + 2}-01`,
          checkOut: `2027-0${i + 2}-03`,
          totalClp: 1,
        },
        "admin-1"
      );
      expect(result.origin).toBe(origin);
      expect(result.reservation.origin).toBe(origin);
      expect(result.reservation.totalClp).toBe(120000);
    }
  });
  it("creates one confirmed multi-room reservation, pending payment, comment and invoice from server-authoritative room data", async () => {
    const result = await createManualReservation(
      {
        ...guest,
        checkIn: "2030-01-01",
        checkOut: "2030-01-03",
        comment: "Llegada tarde",
        guestComment: "Llegada tarde",
        invoiceRequested: "true",
        invoiceName: "Empresa SpA",
        invoiceRut: "76.000.543-6",
        invoicePhone: "123",
        invoiceBusinessActivity: "Hospedaje",
        invoiceEmail: "facturas@example.test",
        origin: "booking",
        roomIds: ["demo-room-andes", "demo-room-valle"],
      },
      "admin-1"
    );
    expect(result.reservation.items).toHaveLength(2);
    expect(result.reservation.status).toBe("confirmed");
    expect(result.payment.status).toBe("pending");
    expect(result.reservation.invoiceRequest?.email).toBe(
      "facturas@example.test"
    );
  });
  it("ignores client-controlled price, status, payment and availability fields", async () => {
    const result = await createManualReservation(
      {
        ...guest,
        checkIn: "2030-02-01",
        checkOut: "2030-02-03",
        origin: "admin",
        roomIds: ["demo-room-andes", "demo-room-valle"],
        availability: false,
        paymentStatus: "approved",
        price: 1,
        status: "cancelled",
        totalClp: 1,
      },
      "admin-1"
    );
    expect(result.reservation.status).toBe("confirmed");
    expect(result.payment.status).toBe("pending");
    expect(result.reservation.totalClp).toBeGreaterThan(1);
  });
  it("rejects an overlapping manual reservation", async () => {
    const input = {
      ...guest,
      origin: "admin",
      checkIn: "2028-01-01",
      checkOut: "2028-01-03",
    };
    await createManualReservation(input, "admin-1");
    await expect(createManualReservation(input, "admin-1")).rejects.toThrow();
  });
  it("rejects a public reservation overlapping a manual reservation", async () => {
    const input = {
      ...guest,
      origin: "booking",
      checkIn: "2028-02-01",
      checkOut: "2028-02-03",
    };
    await createManualReservation(input, "admin-1");
    await expect(confirmPayAtPropertyBooking(input)).rejects.toThrow();
  });
  it("rejects a manual reservation overlapping a public reservation", async () => {
    const input = {
      ...guest,
      room: "demo-room-terra",
      checkIn: "2028-03-01",
      checkOut: "2028-03-03",
    };
    await confirmPayAtPropertyBooking(input);
    await expect(
      createManualReservation({ ...input, origin: "booking" }, "admin-1")
    ).rejects.toThrow();
  });
});
