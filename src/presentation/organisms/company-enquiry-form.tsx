"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, Feedback, Label } from "@/presentation/atoms";
import { FormField } from "@/presentation/molecules";

type FieldName =
  | "company"
  | "contact"
  | "email"
  | "phone"
  | "requirements"
  | "message";

type FormValues = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

const initialValues: FormValues = {
  company: "",
  contact: "",
  email: "",
  phone: "",
  requirements: "",
  message: "",
};

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  for (const field of [
    "company",
    "contact",
    "requirements",
    "message",
  ] as const) {
    if (!values[field].trim()) {
      errors[field] = "Este campo es obligatorio.";
    }
  }

  if (!values.email.trim()) {
    errors.email = "Este campo es obligatorio.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Ingrese un correo electrónico válido.";
  }

  return errors;
}

export function CompanyEnquiryForm() {
  const generated = useId().replace(/:/g, "");
  const prefix = `company-enquiry-${generated}`;
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const update = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitted(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setValues(initialValues);
    setSubmitted(true);
  };

  return (
    <section
      id="consulta-empresa"
      aria-labelledby={`${prefix}-heading`}
      className="mx-auto max-w-content space-y-5 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <div className="max-w-prose space-y-3">
        <h2
          id={`${prefix}-heading`}
          className="font-heading text-title font-normal text-foreground"
        >
          Solicitud para empresas
        </h2>
        <Feedback variant="info" title="Contenido de demostración">
          Este formulario es solo una demostración visual. No envía, guarda ni
          comparte los datos ingresados.
        </Feedback>
      </div>
      <form
        aria-label="Formulario de consulta para empresas de demostración"
        noValidate
        onSubmit={submit}
        className="grid max-w-3xl gap-5 rounded-xl border bg-card p-5 shadow-sm tablet:grid-cols-2"
      >
        <FormField
          id={`${prefix}-company`}
          label="Empresa"
          required
          error={errors.company}
          inputProps={{
            autoComplete: "organization",
            name: "company",
            onChange: (event) => update("company", event.target.value),
            value: values.company,
          }}
        />
        <FormField
          id={`${prefix}-contact`}
          label="Persona de contacto"
          required
          error={errors.contact}
          inputProps={{
            autoComplete: "name",
            name: "contact",
            onChange: (event) => update("contact", event.target.value),
            value: values.contact,
          }}
        />
        <FormField
          id={`${prefix}-email`}
          label="Correo electrónico"
          required
          error={errors.email}
          inputProps={{
            autoComplete: "email",
            name: "email",
            onChange: (event) => update("email", event.target.value),
            type: "email",
            value: values.email,
          }}
        />
        <FormField
          id={`${prefix}-phone`}
          label="Teléfono"
          hint="Opcional"
          inputProps={{
            autoComplete: "tel",
            name: "phone",
            onChange: (event) => update("phone", event.target.value),
            type: "tel",
            value: values.phone,
          }}
        />
        <FormField
          id={`${prefix}-requirements`}
          label="Fechas, cantidad de huéspedes y requisitos"
          required
          error={errors.requirements}
          inputProps={{
            name: "requirements",
            onChange: (event) => update("requirements", event.target.value),
            value: values.requirements,
          }}
        />
        <div className="space-y-2 tablet:col-span-2">
          <Label htmlFor={`${prefix}-message`} required>
            Mensaje
          </Label>
          <textarea
            id={`${prefix}-message`}
            name="message"
            value={values.message}
            onChange={(event) => update("message", event.target.value)}
            aria-describedby={
              errors.message ? `${prefix}-message-error` : undefined
            }
            aria-invalid={errors.message ? true : undefined}
            required
            rows={5}
            className="min-h-28 w-full rounded-md border bg-card px-4 py-3 font-sans text-base text-foreground transition-colors duration-200 ease-standard placeholder:text-muted-foreground focus:border-ring"
          />
          {errors.message ? (
            <p
              id={`${prefix}-message-error`}
              role="alert"
              className="text-body text-destructive"
            >
              {errors.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-3 tablet:col-span-2">
          <Button type="submit">Revisar demostración</Button>
          {submitted ? (
            <Feedback variant="info" title="Demostración sin envío">
              No se enviaron ni guardaron datos. Configure un canal de contacto
              aprobado para recibir solicitudes reales.
            </Feedback>
          ) : null}
        </div>
      </form>
    </section>
  );
}
