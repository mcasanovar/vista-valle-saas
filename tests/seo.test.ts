import { describe, expect, it } from "vitest";

import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { generateMetadata } from "../app/habitaciones/[slug]/page";
import { createPublicMetadata } from "@/seo/public-metadata";
import {
  createLodgingStructuredData,
  createRoomStructuredData,
} from "@/seo/structured-data";
import { mockDemoRooms } from "@/features/rooms";

describe("public SEO metadata", () => {
  it("uses a validated site base with Spanish title, canonical, social, and safe keywords", () => {
    const metadata = createPublicMetadata("https://vista-valle.example");

    expect(metadata.metadataBase?.toString()).toBe(
      "https://vista-valle.example/"
    );
    expect(metadata.title).toEqual({
      default: "Vista Valle | Alojamiento en Illapel",
      template: "%s | Vista Valle",
    });
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.openGraph).toMatchObject({
      locale: "es_CL",
      type: "website",
      url: "https://vista-valle.example",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.keywords).toContain("alojamiento en Illapel");
  });

  it("labels mock room metadata and derives it from the loaded room", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: mockDemoRooms[0].slug }),
    });

    expect(metadata.title).toBe("Habitación Individual");
    expect(metadata.description).toMatch(/Contenido de demostración/);
    expect(metadata.alternates?.canonical).toBe(
      "/habitaciones/habitacion-valle-demo"
    );
  });
});

describe("public discovery metadata", () => {
  it("publishes only public routes and excludes mock room slugs and admin routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      "http://127.0.0.1:3000/",
      "http://127.0.0.1:3000/habitaciones",
    ]);
    expect(urls.join(" ")).not.toMatch(/admin|habitacion-valle-demo/);
  });

  it("allows the public site and disallows administrative routes", () => {
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/"],
    });
    expect(result.sitemap).toBe("http://127.0.0.1:3000/sitemap.xml");
  });
});

describe("public lodging structured data", () => {
  it("does not publish fictional rooms as real lodging places", () => {
    const data = createLodgingStructuredData(
      "https://vista-valle.example",
      mockDemoRooms
    );

    expect(data.containsPlace).toBeUndefined();
    expect(data.additionalProperty).toEqual([
      expect.objectContaining({
        value: expect.stringContaining("Contenido de demostración"),
      }),
    ]);
  });

  it("includes approved room facts and the approved business address/telephone, without inventing coordinates or price", () => {
    const data = createRoomStructuredData("https://vista-valle.example", {
      amenities: ["Wi‑Fi"],
      capacity: 2,
      description: "Descripción aprobada.",
      isDemonstration: false,
      name: "Habitación aprobada",
      slug: "habitacion-aprobada",
    });
    const serialized = JSON.stringify(data);

    expect(data.mainEntity).toMatchObject({
      "@type": "HotelRoom",
      name: "Habitación aprobada",
    });
    expect(data.address).toMatchObject({
      "@type": "PostalAddress",
      addressLocality: "Illapel",
    });
    expect(data.telephone).toBe("+56945981722");
    expect(serialized).not.toMatch(/geo|price/);
  });
});
