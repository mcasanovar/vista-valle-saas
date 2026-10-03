import { expect, test } from "@playwright/test";

test("serves core security headers without a third-party CSP source", async ({
  page,
}) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'"
  );
  expect(headers["content-security-policy"]).not.toContain("https:");

  const hsts = headers["strict-transport-security"] ?? "";
  const maxAgeMatch = hsts.match(/max-age=(\d+)/);
  expect(maxAgeMatch).not.toBeNull();
  expect(Number(maxAgeMatch?.[1])).toBeGreaterThanOrEqual(60 * 60 * 24 * 365 * 2);
});
