import { getOperationalAlerts } from "@/features/admin/operational-alerts";
import { getNotificationDeliveryStatuses } from "@/features/admin/notification-delivery-status";

export default async function AlertsPage() {
  const alerts = await getOperationalAlerts();
  const deliveries = getNotificationDeliveryStatuses();
  return (
    <section>
      <h1>Seguimiento operativo</h1>
      {alerts ? (
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>{alert.label}</li>
          ))}
        </ul>
      ) : (
        <p role="status">El seguimiento no está disponible.</p>
      )}
      <section aria-labelledby="delivery-status-title">
        <h2 id="delivery-status-title">Entregas de notificaciones</h2>
        {deliveries ? (
          deliveries.length > 0 ? (
            <ul aria-live="polite">
              {deliveries.map((delivery, index) => (
                <li key={`${delivery.status}-${delivery.attempts}-${index}`}>
                  {delivery.status === "failed"
                    ? "Entrega fallida"
                    : "Reintento programado"}
                  : intento {delivery.attempts}
                  {delivery.nextAttemptAt
                    ? `; próximo intento ${delivery.nextAttemptAt.toISOString()}`
                    : ""}
                  {delivery.errorCode ? `; código ${delivery.errorCode}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">No hay entregas fallidas ni reintentos.</p>
          )
        ) : (
          <p role="status">El estado de entregas no está disponible.</p>
        )}
      </section>
    </section>
  );
}
