"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/presentation/atoms";
import type { RoomActivationActionResult } from "./actions";

export function RoomDraftActivateButton({
  action,
  roomId,
}: Readonly<{
  action: (data: FormData) => Promise<RoomActivationActionResult>;
  roomId: string;
}>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  const activate = async () => {
    setPending(true);
    setMessage(undefined);
    try {
      const data = new FormData();
      data.set("roomId", roomId);
      const result = await action(data);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    } catch {
      setMessage("No pudimos activar la habitación.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        loading={pending}
        onClick={activate}
        type="button"
      >
        Activar
      </Button>
      {message ? (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
