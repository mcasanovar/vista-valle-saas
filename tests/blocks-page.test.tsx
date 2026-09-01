import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  rooms: vi.fn(),
  form: vi.fn(),
}));
vi.mock("@/features/room-blocks/actions", () => ({
  createRoomBlocksAction: vi.fn(),
  confirmRoomBlocksAction: vi.fn(),
  reviewRoomBlocksAction: vi.fn(),
  removeRoomBlockAction: vi.fn(),
}));
vi.mock("@/features/room-blocks/manual-blocks", () => ({
  listRoomBlocks: mocks.list,
}));
vi.mock("@/features/rooms", () => ({ getRoomReadSource: mocks.rooms }));
vi.mock("@/features/room-blocks/manual-block-form", () => ({
  ManualBlockForm: (props: unknown) => {
    mocks.form(props);
    return null;
  },
}));
import BlocksPage from "../app/(admin-protected)/admin/bloqueos/page";
describe("blocks page", () => {
  it("sanitizes URL filters and keeps quick-create values separate", async () => {
    mocks.list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    mocks.rooms.mockResolvedValue({
      listActive: () => [{ id: "room-1", name: "Valle" }],
    });
    render(
      await BlocksPage({
        searchParams: Promise.resolve({
          roomId: ["bad"],
          status: ["all"],
          page: "oops",
          checkIn: ["bad"],
          quickRoomId: "room-1",
          quickCheckIn: "2035-01-01",
          quickCheckOut: "2035-01-03",
        }),
      })
    );
    expect(mocks.list).toHaveBeenCalledWith({
      roomId: undefined,
      checkIn: undefined,
      checkOut: undefined,
      reason: undefined,
      status: "active",
      page: 1,
    });
    expect(mocks.form).toHaveBeenCalledWith(
      expect.objectContaining({
        rooms: [{ id: "room-1", name: "Valle" }],
        pageSize: 20,
        initialSelection: {
          roomId: "room-1",
          checkIn: "2035-01-01",
          checkOut: "2035-01-03",
        },
      })
    );
  });
  it("drops malformed scalar date pairs before querying", async () => {
    mocks.list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    mocks.rooms.mockResolvedValue({ listActive: () => [] });
    await expect(
      BlocksPage({
        searchParams: Promise.resolve({
          checkIn: "2035-02-30",
          checkOut: "2035-03-02",
          quickCheckIn: "bad",
          quickCheckOut: "2035-01-03",
        }),
      })
    ).resolves.toBeDefined();
    expect(mocks.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ checkIn: undefined, checkOut: undefined })
    );
  });
});
