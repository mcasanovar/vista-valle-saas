import { expect, test } from "@playwright/test";

/**
 * Every public page's main content must be present in the server's raw HTML
 * response: a route whose primary content depends on `useSearchParams()`
 * under an empty-fallback `<Suspense>` would pass with JavaScript enabled
 * (the client resolves it after hydration) but fail here, since this
 * context never executes any client-side JavaScript at all.
 */
test.use({ javaScriptEnabled: false });

const routes: readonly {
  path: string;
  h1: string;
  sectionHeadings: readonly string[];
}[] = [
  {
    path: "/",
    h1: "Hospedaje y habitaciones en Illapel",
    sectionHeadings: [
      "Nuestras habitaciones",
      "Lo esencial, bien cuidado.",
      "Preguntas frecuentes",
    ],
  },
  {
    path: "/habitaciones",
    h1: "Habitaciones",
    sectionHeadings: ["Habitación Individual"],
  },
  {
    path: "/habitaciones/habitacion-valle-demo",
    h1: "Habitación Individual",
    sectionHeadings: ["Características", "Servicios"],
  },
  {
    path: "/ubicacion",
    h1: "Ubicación",
    sectionHeadings: ["La ciudad", "Cómo llegar"],
  },
  {
    path: "/cotizacion-empresa",
    h1: "Solicita una cotización para tu empresa",
    sectionHeadings: ["Fechas y personas"],
  },
];

for (const route of routes) {
  test(`${route.path} serves its heading and section content without JavaScript`, async ({
    page,
  }) => {
    await page.goto(route.path);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      route.h1
    );
    for (const heading of route.sectionHeadings) {
      await expect(
        page.getByRole("heading", { name: heading })
      ).toBeVisible();
    }
  });
}
