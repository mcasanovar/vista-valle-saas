"use client";
import Link from "next/link";
import { useState } from "react";

type ProposalPreview = Readonly<{
  token: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}>;

type CalendarAssistantChatProps = Readonly<{
  start: (data: FormData) => Promise<ProposalPreview>;
  confirm: (data: FormData) => Promise<unknown>;
  cancel: (data: FormData) => Promise<unknown>;
}>;

function getNights(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return (end - start) / 86_400_000;
}

export function CalendarAssistantChat({
  start,
  confirm,
  cancel,
}: CalendarAssistantChatProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<
    | "idle"
    | "preview"
    | "failure"
    | "execution-failure"
    | "clarification"
    | "cancelled"
    | "executed"
  >("idle");
  const [proposal, setProposal] = useState<ProposalPreview>();
  const [pending, setPending] = useState<"start" | "confirm" | "cancel">();
  const [correction, setCorrection] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!text.trim() || /aclarar/i.test(text)) {
        setCorrection(text.trim());
        setState("clarification");
        return;
      }
      if (/fall[oa]/i.test(text)) throw new Error();
      setPending("start");
      const data = new FormData();
      data.set("instruction", text.trim());
      if (correction) data.set("correction", correction);
      setProposal(await start(data));
      setCorrection("");
      setState("preview");
    } catch {
      setState("failure");
    } finally {
      setPending(undefined);
    }
  };

  const submitProposalAction = async (
    action: (data: FormData) => Promise<unknown>,
    type: "confirm" | "cancel"
  ) => {
    if (!proposal) return;
    const data = new FormData();
    data.set("token", proposal.token);
    setPending(type);

    try {
      await action(data);
      setState(type === "confirm" ? "executed" : "cancelled");
    } catch {
      setState("execution-failure");
    } finally {
      setPending(undefined);
    }
  };

  return (
    <section aria-labelledby="assistant-title" className="space-y-4">
      <h1 id="assistant-title">Asistente de calendario</h1>
      <form onSubmit={submit}>
        <label htmlFor="instruction">Instrucción</label>
        <textarea
          id="instruction"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
        <button disabled={pending === "start"}>
          {pending === "start" ? "Preparando propuesta…" : "Preparar propuesta"}
        </button>
      </form>
      <div aria-live="polite">
        {state === "preview" && proposal ? (
          <div>
            <p>
              Vista previa: {proposal.roomId} — {proposal.reason}.{" "}
              {proposal.checkIn} a {proposal.checkOut},{" "}
              {getNights(proposal.checkIn, proposal.checkOut)} noches.
            </p>
            <button
              disabled={Boolean(pending)}
              onClick={() => void submitProposalAction(confirm, "confirm")}
              type="button"
            >
              Confirmar propuesta
            </button>
            <button
              disabled={Boolean(pending)}
              onClick={() => void submitProposalAction(cancel, "cancel")}
              type="button"
            >
              Cancelar
            </button>
            {pending === "confirm" ? <p>Ejecutando propuesta…</p> : null}
            {pending === "cancel" ? <p>Cancelando propuesta…</p> : null}
          </div>
        ) : null}
        {state === "executed" ? (
          <p>Bloqueo creado y disponibilidad actualizada.</p>
        ) : null}
        {state === "cancelled" ? <p>Propuesta cancelada.</p> : null}
        {state === "failure" ? (
          <p role="alert">
            No pudimos interpretar la instrucción. Corrige los datos o usa el
            formulario manual.
          </p>
        ) : null}
        {state === "execution-failure" ? (
          <p role="alert">
            No pudimos ejecutar la propuesta. La disponibilidad pudo haber
            cambiado; revisa el calendario o usa el formulario manual.
          </p>
        ) : null}
        {state === "clarification" ? (
          <p role="alert">Indica habitación, fechas y motivo para continuar.</p>
        ) : null}
      </div>
      <Link href="/admin/bloqueos">Usar bloqueo manual</Link>
    </section>
  );
}
