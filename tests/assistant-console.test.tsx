import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAssistantThreadAction: vi.fn() }));
vi.mock("@/features/assistant/thread-actions", () => ({
  getAssistantThreadAction: mocks.getAssistantThreadAction,
}));

import { AssistantConsole } from "@/features/assistant/assistant-console";

describe("AssistantConsole thread list (task 8.5)", () => {
  it("restores a previous thread's messages when it is selected, preserving context", async () => {
    mocks.getAssistantThreadAction.mockResolvedValue({
      createdAt: new Date(),
      id: "thread-1",
      messages: [
        { content: "Bloquea la habitación Andes", createdAt: new Date(), id: "m1", role: "user" },
        { content: "Listo, ¿confirmas?", createdAt: new Date(), id: "m2", role: "assistant" },
      ],
      title: "Bloqueo Andes",
      updatedAt: new Date(),
    });

    const user = userEvent.setup();
    render(
      <AssistantConsole
        cancelProposal={vi.fn()}
        confirmProposal={vi.fn()}
        initialThreads={[
          { id: "thread-1", title: "Bloqueo Andes", updatedAt: new Date() },
        ]}
      />
    );

    expect(
      screen.queryByText("Bloquea la habitación Andes")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bloqueo Andes" }));

    expect(mocks.getAssistantThreadAction).toHaveBeenCalledWith("thread-1");
    expect(await screen.findByText("Bloquea la habitación Andes")).toBeInTheDocument();
    expect(screen.getByText("Listo, ¿confirmas?")).toBeInTheDocument();
  });

  it("starting a new thread clears the current conversation from view", async () => {
    mocks.getAssistantThreadAction.mockResolvedValue({
      createdAt: new Date(),
      id: "thread-1",
      messages: [
        { content: "Mensaje previo", createdAt: new Date(), id: "m1", role: "user" },
      ],
      title: "Hilo previo",
      updatedAt: new Date(),
    });

    const user = userEvent.setup();
    render(
      <AssistantConsole
        cancelProposal={vi.fn()}
        confirmProposal={vi.fn()}
        initialThreads={[
          { id: "thread-1", title: "Hilo previo", updatedAt: new Date() },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Hilo previo" }));
    expect(await screen.findByText("Mensaje previo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nuevo hilo" }));
    expect(screen.queryByText("Mensaje previo")).not.toBeInTheDocument();
  });
});

describe("AssistantConsole proposal card lifecycle (regression, task 12.2)", () => {
  it("keeps the proposal card visible with its failure message when confirmation fails, instead of unmounting it", async () => {
    const proposals = [
      { operation: "crear_bloqueo", payload: { roomIds: ["demo-room-valle"] }, token: "token-1" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        headers: new Headers({
          "X-Assistant-Proposals": btoa(JSON.stringify(proposals)),
          "X-Assistant-Thread-Id": "thread-1",
        }),
        ok: true,
        text: async () => "Preparé una propuesta.",
      })
    );
    const confirmProposal = vi.fn().mockResolvedValue({
      message: "La disponibilidad cambió.",
      ok: false,
    });
    const user = userEvent.setup();

    render(
      <AssistantConsole
        cancelProposal={vi.fn()}
        confirmProposal={confirmProposal}
        initialThreads={[]}
      />
    );

    await user.type(
      screen.getByLabelText("Instrucción para el asistente"),
      "Bloquea la habitación Valle"
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Propuesta pendiente");

    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("No pudimos confirmar")).toBeInTheDocument();
    expect(screen.getByText("La disponibilidad cambió.")).toBeInTheDocument();
    // The card itself is still there — confirming again is still possible.
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe("AssistantConsole voice input (task 9.1)", () => {
  it("keeps the text input fully operational after the microphone permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new Error("Permission denied")),
      },
    });
    const user = userEvent.setup();

    render(
      <AssistantConsole
        cancelProposal={vi.fn()}
        confirmProposal={vi.fn()}
        initialThreads={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Dictar" }));
    expect(
      await screen.findByText(/no pudimos acceder al micrófono/i)
    ).toBeInTheDocument();

    const textarea = screen.getByLabelText("Instrucción para el asistente");
    await user.type(textarea, "Busca disponibilidad para mañana");
    expect(textarea).toHaveValue("Busca disponibilidad para mañana");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
  });
});

describe("AssistantConsole voice input auto-send", () => {
  it("sends the transcribed text automatically as soon as dictation stops, with no extra click", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [] }),
      },
    });
    class FakeMediaRecorder {
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.ondataavailable?.({ data: new Blob(["audio"]) });
      }
      stop() {
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/admin/assistant/transcribe") {
        return Promise.resolve({
          json: async () => ({ text: "Bloquea la habitación Andes" }),
          ok: true,
        });
      }
      return Promise.resolve({
        headers: new Headers({ "X-Assistant-Thread-Id": "thread-new" }),
        ok: true,
        text: async () => "Listo.",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <AssistantConsole
        cancelProposal={vi.fn()}
        confirmProposal={vi.fn()}
        initialThreads={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Dictar" }));
    await user.click(screen.getByRole("button", { name: "Detener dictado" }));

    // No click on "Enviar" — stopping dictation is what sends it.
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/assistant",
        expect.objectContaining({
          body: JSON.stringify({
            instruction: "Bloquea la habitación Andes",
            threadId: undefined,
          }),
        })
      );
    });
    expect(
      (await screen.findAllByText("Bloquea la habitación Andes")).length
    ).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
