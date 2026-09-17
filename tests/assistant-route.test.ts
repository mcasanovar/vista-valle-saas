import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnvironment: vi.fn(),
  requireAdministrator: vi.fn(),
  handleAssistantConversation: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/assistant/conversation-handler", () => ({
  handleAssistantConversation: mocks.handleAssistantConversation,
}));
vi.mock("@/config/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/server")>();
  return {
    ...actual,
    getServerEnvironment: (...args: Parameters<typeof actual.getServerEnvironment>) =>
      mocks.getServerEnvironment(actual.getServerEnvironment(...args)),
  };
});

import { POST } from "../app/api/admin/assistant/route";

describe("POST /api/admin/assistant (task 7.2)", () => {
  beforeEach(() => {
    mocks.getServerEnvironment.mockImplementation((real) => ({
      ...real,
      ASSISTANT_ENABLED: true,
    }));
  });

  it("rejects an unauthenticated request without reading or interpreting the body", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(
      new Error("Administrative authorization failed: missing_session")
    );
    const jsonSpy = vi.fn();
    const request = {
      json: jsonSpy,
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(mocks.handleAssistantConversation).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/assistant behind ASSISTANT_ENABLED (task 11.6)", () => {
  it("behaves as before the change while the flag is off: unavailable, nothing interpreted", async () => {
    mocks.getServerEnvironment.mockImplementation((real) => ({
      ...real,
      ASSISTANT_ENABLED: false,
    }));
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    const jsonSpy = vi.fn();
    const request = { json: jsonSpy } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(404);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(mocks.handleAssistantConversation).not.toHaveBeenCalled();
  });

  it("proceeds normally once the flag is on, with no other effect on the request handling", async () => {
    mocks.getServerEnvironment.mockImplementation((real) => ({
      ...real,
      ASSISTANT_ENABLED: true,
    }));
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.handleAssistantConversation.mockResolvedValue({
      kind: "ok",
      proposals: [],
      reachedRoundLimit: false,
      text: "Listo.",
      threadId: "thread-1",
    });
    const request = {
      json: async () => ({ instruction: "hola" }),
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.handleAssistantConversation).toHaveBeenCalledTimes(1);
  });
});
