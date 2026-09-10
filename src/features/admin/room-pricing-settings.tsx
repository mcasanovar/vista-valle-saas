"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Feedback, Text } from "@/presentation/atoms";
import { FormField } from "@/presentation/molecules";

type RoomPricingRecord = Readonly<{
  roomId: string;
  name: string;
  capacity: number;
  priceOneGuestClp: number;
  priceTwoGuestsClp: number;
}>;

export function RoomPricingSettings({
  roomId,
}: Readonly<{ roomId: string }>) {
  const [record, setRecord] = useState<RoomPricingRecord | null>(null);
  const [priceOneGuestClp, setPriceOneGuestClp] = useState("");
  const [priceTwoGuestsClp, setPriceTwoGuestsClp] = useState("");
  const [samePrice, setSamePrice] = useState(true);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<
    "loading" | "idle" | "saving" | "saved" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/habitaciones/${roomId}/tarifas`, {
      credentials: "same-origin",
    })
      .then((response) => {
        if (!response.ok) throw new Error("No pudimos cargar la tarifa.");
        return response.json() as Promise<RoomPricingRecord>;
      })
      .then((data) => {
        if (cancelled) return;
        setRecord(data);
        setPriceOneGuestClp(String(data.priceOneGuestClp));
        setPriceTwoGuestsClp(String(data.priceTwoGuestsClp));
        setSamePrice(data.priceOneGuestClp === data.priceTwoGuestsClp);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const hasOccupancyChoice = (record?.capacity ?? 1) > 1;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || status === "saving") return;
    const priceOneGuestClpValue = Number(priceOneGuestClp);
    const priceTwoGuestsClpValue = hasOccupancyChoice
      ? samePrice
        ? priceOneGuestClpValue
        : Number(priceTwoGuestsClp)
      : priceOneGuestClpValue;
    if (
      !Number.isSafeInteger(priceOneGuestClpValue) ||
      priceOneGuestClpValue <= 0 ||
      !Number.isSafeInteger(priceTwoGuestsClpValue) ||
      priceTwoGuestsClpValue <= 0
    ) {
      setError("Indica precios válidos en CLP.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/habitaciones/${roomId}/tarifas`, {
        body: JSON.stringify({
          priceOneGuestClp: priceOneGuestClpValue,
          priceTwoGuestsClp: priceTwoGuestsClpValue,
        }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) throw new Error("No pudimos guardar la tarifa.");
      const updated = (await response.json()) as RoomPricingRecord;
      setRecord(updated);
      setPriceOneGuestClp(String(updated.priceOneGuestClp));
      setPriceTwoGuestsClp(String(updated.priceTwoGuestsClp));
      setStatus("saved");
    } catch {
      setError("No pudimos guardar la tarifa.");
      setStatus("error");
    }
  }

  if (status === "loading" || !record) {
    return <Text className="text-muted-foreground">Cargando…</Text>;
  }

  return (
    <section className="max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-heading text-title text-foreground">
          {record.name}
        </h2>
        <Text className="mt-1 text-muted-foreground">
          {hasOccupancyChoice
            ? "Define el precio por noche según la cantidad de personas que se alojen."
            : "Esta habitación admite 1 huésped como máximo: un único precio por noche."}
        </Text>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {hasOccupancyChoice ? (
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={samePrice}
              onChange={(event) => setSamePrice(event.target.checked)}
            />
            Cobrar el mismo precio para 1 o 2 personas
          </label>
        ) : null}
        <FormField
          id="room-pricing-one"
          label={hasOccupancyChoice ? "Precio para 1 persona" : "Precio por noche"}
          required
          inputProps={{
            min: 0,
            onChange: (event) => {
              setPriceOneGuestClp(event.target.value);
              if (samePrice) setPriceTwoGuestsClp(event.target.value);
            },
            type: "number",
            value: priceOneGuestClp,
          }}
        />
        {hasOccupancyChoice ? (
          <FormField
            id="room-pricing-two"
            label="Precio para 2 personas"
            required
            inputProps={{
              disabled: samePrice,
              min: 0,
              onChange: (event) => setPriceTwoGuestsClp(event.target.value),
              type: "number",
              value: samePrice ? priceOneGuestClp : priceTwoGuestsClp,
            }}
          />
        ) : null}
        {error ? (
          <Feedback variant="error" title="No pudimos guardar">
            {error}
          </Feedback>
        ) : null}
        {status === "saved" ? (
          <Feedback variant="success" title="Guardado">
            La tarifa se actualizó correctamente.
          </Feedback>
        ) : null}
        <Button
          disabled={status === "saving"}
          loading={status === "saving"}
          type="submit"
        >
          Guardar tarifas
        </Button>
      </form>
    </section>
  );
}
