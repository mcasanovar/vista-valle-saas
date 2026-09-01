import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const responsiveViewports = [
  { name: "small-phone", width: 320, height: 800 },
  { name: "mobile", width: 375, height: 800 },
  { name: "tablet", width: 768, height: 900 },
  { name: "notebook", width: 1024, height: 900 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
}

test("public keyboard journey exposes a skip link, visible focus, and booking controls", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.getByRole("main")).toBeVisible();

  await page
    .getByRole("link", { name: "Reservar", exact: true })
    .first()
    .focus();
  await expect(
    page.getByRole("link", { name: "Reservar", exact: true }).first()
  ).toBeFocused();
  await expect(page.getByLabel("Fecha de entrada")).toBeVisible();
  await expect(page.getByLabel("Fecha de salida")).toBeVisible();
});

test("public pages preserve semantic landmarks, alternative text, and responsive layout", async ({
  page,
}) => {
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navegación principal" })
    ).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Descansa con una experiencia para recordar",
      })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expect(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images.every((image) => image.hasAttribute("alt"))
        )
    ).toBe(true);
  }
});

test("public pages have no automated accessibility violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const route of [
    "/",
    "/habitaciones",
    "/habitaciones/habitacion-valle-demo",
    "/cotizacion-empresa",
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test("home search remains accessible in dark theme", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();

  await expect(
    page.getByRole("form", { name: "Consulta de disponibilidad" })
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("public home visual layout is stable at every supported breakpoint", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Descansa con una experiencia para recordar",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("form", { name: "Consulta de disponibilidad" })
    ).toBeVisible();
    // Playwright's animation switch does not freeze Framer Motion's JS values.
    // Normalize reveal wrappers so screenshots capture the settled layout.
    await page.addStyleTag({
      content:
        '[data-motion="enabled"] { opacity: 1 !important; transform: none !important; } nextjs-portal { display: none !important; }',
    });
    await expect(page).toHaveScreenshot(`public-home-${viewport.name}.png`, {
      animations: "disabled",
      caret: "hide",
    });
  }
});

test("public metadata, canonical discovery files, and structured data are indexable", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Vista Valle | Alojamiento en Illapel");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Vista Valle/
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "http://127.0.0.1:3000"
  );

  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.map((script) => JSON.parse(script.textContent ?? "{}"))
    );
  expect(structuredData).toContainEqual(
    expect.objectContaining({ "@context": "https://schema.org" })
  );

  const [robots, sitemap] = await Promise.all([
    page.request.get("/robots.txt"),
    page.request.get("/sitemap.xml"),
  ]);

  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow: /admin");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("http://127.0.0.1:3000/habitaciones");
});

test("production server produces a navigation and resource performance profile", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.E2E_SERVER_MODE !== "production",
    "This profile is intentionally run against next start by test:quality."
  );

  await page.goto("/");
  const profile = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    const paints = performance
      .getEntriesByType("paint")
      .map(({ name, startTime }) => ({ name, startTime }));

    return {
      navigation: navigation
        ? {
            domContentLoaded: navigation.domContentLoadedEventEnd,
            duration: navigation.duration,
            responseStart: navigation.responseStart,
            transferSize: navigation.transferSize,
          }
        : null,
      paints,
      resources: {
        count: resources.length,
        totalTransferSize: resources.reduce(
          (total, resource) => total + resource.transferSize,
          0
        ),
      },
    };
  });

  expect(profile.navigation).not.toBeNull();
  expect(profile.navigation?.responseStart).toBeGreaterThan(0);
  expect(profile.navigation?.duration).toBeGreaterThan(0);
  expect(profile.resources.count).toBeGreaterThan(0);
  await testInfo.attach("production-performance-profile.json", {
    body: JSON.stringify(profile, null, 2),
    contentType: "application/json",
  });
});
