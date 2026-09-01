import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import {
  Amenities,
  ContactLink,
  DateField,
  FormField,
  GuestCounter,
  Price,
  StatusPresentation,
  type ContactHref,
} from "@/presentation/molecules";

describe("presentation molecules", () => {
  it("connects and deduplicates field descriptions and inline errors", () => {
    render(
      <>
        <p id="external">Ayuda externa</p>
        <FormField
          id="email"
          label="Correo"
          hint="Ayuda persistente"
          error="Indique un correo válido"
          inputProps={{
            "aria-describedby": "external email-hint external",
          }}
        />
      </>
    );

    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "external email-hint email-error"
    );
    expect(screen.getByText("Ayuda persistente")).toHaveAttribute(
      "id",
      "email-hint"
    );
    expect(screen.getByRole("alert")).toHaveAttribute("id", "email-error");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Indique un correo válido"
    );
  });

  it("keeps native date-only strings without timezone conversion", async () => {
    render(
      <DateField
        id="arrival"
        label="Fecha"
        value="2026-08-17"
        min="2026-01-01"
        max="2026-12-31"
        readOnly
      />
    );

    const input = screen.getByLabelText("Fecha");
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveValue("2026-08-17");
    expect(input).toHaveAttribute("min", "2026-01-01");
    expect(input).toHaveAttribute("max", "2026-12-31");

    const source = await readFile(
      "src/presentation/molecules/molecules.tsx",
      "utf8"
    );
    expect(source).not.toMatch(/new\s+Date\s*\(/);
    expect(source).not.toMatch(/Date\.parse\s*\(/);
  });

  it("fails closed for ambiguous controlled date fields", () => {
    expect(() =>
      render(<DateField id="date" label="Fecha" value="2026-08-17" />)
    ).toThrow(/requires onChange or readOnly/);
    expect(() =>
      render(
        <DateField
          id="date"
          label="Fecha"
          value="2026-08-17"
          defaultValue="2026-08-18"
          readOnly
        />
      )
    ).toThrow(/both value and defaultValue/);
  });

  it("keeps guest controls keyboard-accessible and inside bounds", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <GuestCounter
        label="Huéspedes"
        value={1}
        min={1}
        max={2}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("group", { name: "Huéspedes" })).toBeVisible();
    const decrease = screen.getByRole("button", {
      name: "Restar Huéspedes",
    });
    const increase = screen.getByRole("button", {
      name: "Aumentar Huéspedes",
    });
    expect(decrease).toBeDisabled();
    expect(decrease).toHaveClass("min-h-11", "min-w-11");
    expect(increase).toHaveClass("min-h-11", "min-w-11");
    expect(increase).toHaveClass("p-3");
    expect(screen.getByRole("status", { name: "Huéspedes: 1" })).toHaveClass(
      "text-sm"
    );
    expect(decrease.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(increase.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(
      screen.getByRole("status", { name: "Huéspedes: 1" })
    ).toHaveAttribute("aria-atomic", "true");

    await user.click(decrease);
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(increase).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2);

    rerender(
      <GuestCounter
        label="Huéspedes"
        value={2}
        min={1}
        max={2}
        onChange={onChange}
      />
    );
    expect(increase).toBeDisabled();
    await user.click(increase);
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.click(decrease);
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("rejects invalid guest counter contracts", () => {
    const onChange = vi.fn();
    expect(() =>
      render(
        <GuestCounter
          label="Huéspedes"
          value={1.5}
          min={1}
          max={2}
          onChange={onChange}
        />
      )
    ).toThrow(/Invalid guest counter bounds/);
    expect(() =>
      render(
        <GuestCounter
          label="Huéspedes"
          value={2}
          min={3}
          max={2}
          onChange={onChange}
        />
      )
    ).toThrow(/Invalid guest counter bounds/);
  });

  it("formats only safe, non-negative integer CLP amounts", () => {
    render(<Price amount={12000} label="Tarifa" suffix="por noche" />);
    expect(screen.getByText(/Tarifa/)).toHaveTextContent(/12\.000/);
    expect(screen.getByText(/Tarifa/)).toHaveTextContent("por noche");
    expect(() => render(<Price amount={-1} />)).toThrow();
    expect(() => render(<Price amount={1.2} />)).toThrow();
    expect(() =>
      render(<Price amount={Number.MAX_SAFE_INTEGER + 1} />)
    ).toThrow();
  });

  it("renders amenities as a textual semantic list with decorative icons", () => {
    const { container } = render(
      <Amenities
        items={[
          { id: "first", label: "Servicio uno" },
          { id: "second", label: "Servicio dos" },
        ]}
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("list")).toHaveTextContent("Servicio uno");
    for (const icon of container.querySelectorAll("svg")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps configured contact channels safe, visible, and focusable", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <ContactLink href="tel:+56900000000">Llamar</ContactLink>
        <ContactLink href="mailto:contacto@example.test">Escribir</ContactLink>
        <ContactLink href="https://example.test/contacto?origen=web">
          Contactar
        </ContactLink>
      </>
    );

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "tel:+56900000000");
    expect(links[1]).toHaveAttribute("href", "mailto:contacto@example.test");
    expect(links[2]).toHaveAttribute(
      "href",
      "https://example.test/contacto?origen=web"
    );
    for (const link of links) expect(link).not.toHaveAttribute("target");
    for (const icon of container.querySelectorAll("svg")) {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
    await user.tab();
    expect(links[0]).toHaveFocus();
  });

  it("rejects unsafe or empty contact links", () => {
    const invalid = [
      "javascript:alert(1)",
      "tel:",
      "mailto:",
      "https://",
      "https://user:secret@example.test",
    ];
    for (const href of invalid) {
      expect(() =>
        render(<ContactLink href={href as ContactHref}>Contacto</ContactLink>)
      ).toThrow(/Unsupported contact link/);
    }
    expect(() =>
      render(<ContactLink href="https://example.test">{" "}</ContactLink>)
    ).toThrow(/Unsupported contact link/);
  });

  it("presents status with visible label and optional description", () => {
    render(
      <StatusPresentation
        label="Pendiente"
        description="Requiere revisión"
        tone="warning"
      />
    );
    expect(screen.getByText("Pendiente")).toBeVisible();
    expect(screen.getByText("Requiere revisión")).toBeVisible();
  });
});
