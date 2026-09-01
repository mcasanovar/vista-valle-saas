import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  ActionLink,
  Badge,
  Button,
  Feedback,
  Heading,
  Icon,
  Input,
  Label,
  LoadingState,
  Spinner,
  Text,
  VistaValleBrand,
} from "@/presentation/atoms";

describe("presentation atoms", () => {
  it("uses tokenized pressed states without global active opacity", async () => {
    const source = await readFile("src/presentation/atoms/atoms.tsx", "utf8");
    expect(source).not.toMatch(/active:opacity-/);
    expect(source).toContain("bg-primary text-on-primary");
    expect(source).toContain("active:bg-primary");
    expect(source).toContain("text-xs");
  });
  it("renders semantic typography", () => {
    render(
      <>
        <Heading level={1}>Título</Heading>
        <Text>Texto</Text>
      </>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Título" })
    ).toBeVisible();
    expect(screen.getByText("Texto").tagName).toBe("P");
  });

  it("renders the reusable real brand asset with descriptive alternative text", () => {
    render(
      <a aria-label="Vista Valle" href="#inicio">
        <VistaValleBrand />
      </a>
    );
    expect(screen.getByRole("link", { name: "Vista Valle" })).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Vista Valle Lodging House" })
    ).toHaveAttribute("src", expect.stringContaining("vista-valle-logo.png"));
  });

  it("uses native button defaults, keyboard activation, and stable loading semantics", async () => {
    const user = userEvent.setup();
    const click = vi.fn();
    render(
      <>
        <Button onClick={click}>Continuar</Button>
        <Button loading>Guardar</Button>
      </>
    );
    const button = screen.getByRole("button", { name: "Continuar" });
    expect(button).toHaveAttribute("type", "button");
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("renders a focusable semantic internal link", async () => {
    const user = userEvent.setup();
    render(
      <ActionLink href="/habitaciones" variant="action">
        Ver habitaciones
      </ActionLink>
    );
    const link = screen.getByRole("link", { name: "Ver habitaciones" });
    expect(link).toHaveAttribute("href", "/habitaciones");
    await user.tab();
    expect(link).toHaveFocus();
  });

  it("links labels, input state, and required text accessibly", () => {
    render(
      <>
        <Label htmlFor="email" required>
          Correo
        </Label>
        <Input id="email" aria-invalid="true" readOnly disabled />
      </>
    );
    expect(screen.getByLabelText(/Correo/)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByText("(requerido)")).toBeVisible();
    expect(screen.getByLabelText(/Correo/)).toBeDisabled();
  });

  it("enforces icon accessibility contracts", () => {
    render(
      <>
        <Icon name="Check" decorative />
        <Icon name="Info" title="Información" />
      </>
    );
    expect(screen.queryByRole("img", { name: "Check" })).toBeNull();
    expect(screen.getByRole("img", { name: "Información" })).toBeVisible();
    expect(() => {
      // @ts-expect-error runtime fail-closed protection for untyped callers
      render(<Icon name="Info" />);
    }).toThrow(/requires a title/);
  });

  it("provides textual badge and live feedback/loading states", () => {
    render(
      <>
        <Badge variant="warning">Pendiente</Badge>
        <Feedback variant="error" title="Error">
          Revise el campo.
        </Feedback>
        <LoadingState label="Cargando datos" />
        <Spinner label="Procesando" />
      </>
    );
    expect(screen.getByText("Pendiente")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Error");
    expect(
      screen.getByRole("status", { name: "Cargando datos" })
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Procesando" })).toBeVisible();
  });
});
