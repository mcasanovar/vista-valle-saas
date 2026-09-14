import {
  normalizePaymentMethodSettingsInput,
  PaymentMethodSettingsInputError,
} from "@/features/payments";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getServerPaymentMethodSettingsRepository } from "@/infrastructure/database/payment-method-settings-source";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const repository = getServerPaymentMethodSettingsRepository();
  if (!repository) {
    return Response.json(
      { error: "La configuración de métodos de pago no está disponible." },
      { status: 503 }
    );
  }
  return Response.json(await repository.get());
}

export async function PUT(request: Request) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const input = normalizePaymentMethodSettingsInput(await request.json());
    const repository = getServerPaymentMethodSettingsRepository();
    if (!repository) {
      return Response.json(
        { error: "La configuración de métodos de pago no está disponible." },
        { status: 503 }
      );
    }
    return Response.json(await repository.update(input));
  } catch (error) {
    if (error instanceof PaymentMethodSettingsInputError) {
      return Response.json(
        { code: error.code, issues: error.issues, message: error.message },
        { status: 400 }
      );
    }
    return Response.json(
      { error: "No pudimos actualizar los métodos de pago." },
      { status: 500 }
    );
  }
}
