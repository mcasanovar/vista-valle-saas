import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  transcribe: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/assistant/transcriber-provider", () => ({
  getSpeechTranscriber: () => ({ transcribe: mocks.transcribe }),
}));

import { POST } from "../app/api/admin/assistant/transcribe/route";

describe("POST /api/admin/assistant/transcribe (task 9.2)", () => {
  it("rejects a request without an administrator session, without transcribing anything", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(
      new Error("Administrative authorization failed: missing_session")
    );
    const blobSpy = vi.fn();
    const request = { blob: blobSpy, headers: new Headers() } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(blobSpy).not.toHaveBeenCalled();
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });
});
