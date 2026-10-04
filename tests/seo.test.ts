import { describe, expect, it } from "vitest";

import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { generateMetadata } from "../app/habitaciones/[slug]/page";
import { createPublicMetadata } from "@/seo/public-metadata";
import {
  createBreadcrumbStructuredData,
  createFaqStructuredData,
  createLodgingStructuredData,
  createRoomStructuredData,
} from "@/seo/structured-data";
import { mockDemoRooms } from "@/features/rooms";
import { publicFaq } from "@/config/public-site-content";

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
      "http://127.0.0.1:3000/ubicacion",
      "http://127.0.0.1:3000/cotizacion-empresa",
    ]);
    expect(urls.join(" ")).not.toMatch(/admin|habitacion-valle-demo/);
  });

  it("declares a lastModified date for every sitemap entry", async () => {
    const entries = await sitemap();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
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

  it("includes approved room facts and the approved business address/telephone", () => {
    const data = createRoomStructuredData("https://vista-valle.example", {
      amenities: ["Wi‑Fi"],
      capacity: 2,
      description: "Descripción aprobada.",
      images: [{ alt: "Habitación aprobada", src: "/rooms/aprobada.jpg" }],
      isDemonstration: false,
      name: "Habitación aprobada",
      nightlyPriceClp: 50_000,
      slug: "habitacion-aprobada",
    });

    expect(data.mainEntity).toMatchObject({
      "@type": "HotelRoom",
      name: "Habitación aprobada",
      offers: { "@type": "Offer", priceCurrency: "CLP", price: 50_000 },
    });
    expect(data.address).toMatchObject({
      "@type": "PostalAddress",
      addressLocality: "Illapel",
    });
    expect(data.telephone).toBe("+56945981722");
  });

  it("includes the confirmed local SEO signals: geo, check-in/out, pets, amenities, email, map, and external profiles", () => {
    const data = createLodgingStructuredData("https://vista-valle.example", [
      {
        amenities: [],
        capacity: 2,
        description: "Descripción aprobada.",
        images: [{ alt: "Foto", src: "/rooms/aprobada.jpg" }],
        isDemonstration: false,
        name: "Habitación aprobada",
        nightlyPriceClp: 50_000,
        slug: "habitacion-aprobada",
      },
    ]);

    expect(data.geo).toMatchObject({
      "@type": "GeoCoordinates",
      latitude: -31.630434,
      longitude: -71.1754513,
    });
    expect(data.checkinTime).toBe("15:00");
    expect(data.checkoutTime).toBe("12:00");
    expect(data.petsAllowed).toBe(false);
    expect(data.email).toBe("hola@vistavallehospedaje.com");
    expect(data.hasMap).toMatch(/google\.com\/maps/);
    expect(data.sameAs).toEqual([
      "https://www.booking.com/hotel/cl/vista-valle.es.html",
    ]);
    expect(data.amenityFeature).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Wi-Fi gratuito" }),
        expect.objectContaining({ name: "Estacionamiento privado" }),
      ])
    );
    expect(data.priceRange).toBe("$50.000 CLP");
    expect(Array.isArray(data.image)).toBe(true);
    expect((data.image as readonly string[]).length).toBeGreaterThanOrEqual(2);
  });

  it("never declares aggregateRating or review for third-party ratings", () => {
    const data = createLodgingStructuredData("https://vista-valle.example", [
      {
        amenities: [],
        capacity: 2,
        description: "Descripción aprobada.",
        isDemonstration: false,
        name: "Habitación aprobada",
        nightlyPriceClp: 50_000,
        slug: "habitacion-aprobada",
      },
    ]);

    expect(data.aggregateRating).toBeUndefined();
    expect(data.review).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|"review"/);
  });
});

describe("public FAQ structured data", () => {
  it("declares exactly the same questions the FAQ section renders, no more and no less", () => {
    const data = createFaqStructuredData();

    expect(data?.mainEntity).toHaveLength(publicFaq.length);
    expect(data?.mainEntity.map((entry) => entry.name)).toEqual(
      publicFaq.map((entry) => entry.question)
    );
  });
});

describe("public breadcrumb structured data", () => {
  it("places a route's position relative to the home page", () => {
    const data = createBreadcrumbStructuredData("https://vista-valle.example", [
      { name: "Habitaciones", url: "/habitaciones" },
      { name: "Habitación Doble", url: "/habitaciones/habitacion-doble" },
    ]);

    expect(data.itemListElement).toEqual([
      expect.objectContaining({
        position: 1,
        name: "Inicio",
        item: "https://vista-valle.example",
      }),
      expect.objectContaining({
        position: 2,
        name: "Habitaciones",
        item: "https://vista-valle.example/habitaciones",
      }),
      expect.objectContaining({
        position: 3,
        name: "Habitación Doble",
        item: "https://vista-valle.example/habitaciones/habitacion-doble",
      }),
    ]);
  });
});
