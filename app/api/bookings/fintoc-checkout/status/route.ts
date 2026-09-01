import { getFintocCheckoutStatus } from "@/features/payments/fintoc-checkout-status";

export async function GET(request: Request) {
  const paymentId = new URL(request.url).searchParams.get("payment");
  if (!paymentId) {
    return Response.json({ status: "not_found" }, { status: 400 });
  }
  const result = await getFintocCheckoutStatus(paymentId);
  return Response.json(result, { status: 200 });
}
