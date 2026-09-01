import type { MetadataRoute } from "next";
import { getServerEnvironment } from "@/config/server";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getServerEnvironment().SITE_URL;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
