import type { MetadataRoute } from "next";
import { getRoomReadSource } from "@/features/rooms";
import { getServerEnvironment } from "@/config/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getServerEnvironment().SITE_URL;
  const roomSource = await getRoomReadSource();
  const roomRoutes = roomSource
    .listActive()
    .filter((room) => !room.isDemonstration)
    .map((room) => ({
      url: new URL(`/habitaciones/${room.slug}`, siteUrl).toString(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

  return [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/habitaciones", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...roomRoutes,
  ];
}
