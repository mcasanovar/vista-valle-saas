import { describe, expect, it } from "vitest";
import {
  buildBookingSummary,
  BookingSummaryInputError,
} from "@/features/reservations";
import { createRoomReadSource, mockDemoRooms } from "@/features/rooms";
const rooms = createRoomReadSource("mock", mockDemoRooms);
const candidate = {
  room: "habitacion-valle-demo",
  checkIn: "2026-10-05",
  checkOut: "2026-10-08",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "+56 9 1111 1111",
  guestCount: "1",
  totalClp: "1",
  nightlyPriceClp: "1",
};
describe("authoritative booking summary", () => {
  it("recalculates nights and price rather than trusting client totals", () => {
    const summary = buildBookingSummary(candidate, rooms);
    expect(summary.pricing).toMatchObject({
      nights: 3,
      nightlyPriceClp: 55000,
      chargesClp: 0,
      totalClp: 165000,
    });
  });
  it("rejects incomplete guests and unknown rooms", () => {
    expect(() =>
      buildBookingSummary({ ...candidate, email: "" }, rooms)
    ).toThrow(BookingSummaryInputError);
    expect(() =>
      buildBookingSummary({ ...candidate, room: "inventada" }, rooms)
    ).toThrow(BookingSummaryInputError);
  });
});
