import type { NextConfig } from "next";

// Room photos in production are served from Supabase Storage's public
// bucket URL, e.g. https://<project-ref>.supabase.co/storage/v1/object/public/room-images/...
// next/image requires every remote source host to be explicitly allowed.
const supabaseImageHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;
const cloudinaryImageHostname = "res.cloudinary.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `img-src 'self' ${cloudinaryImageHostname} data: blob:`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${
    process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"
  }`,
  "connect-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

// Only set when testing the dev server through a tunnel (e.g. ngrok) so a
// webhook provider can reach it; without this, Next.js blocks the HMR
// WebSocket from that origin and silently falls back to full page reloads,
// which resets any client-side state (e.g. the Fintoc checkout status
// poller) on every reload. Never set in a real deployment.
const devTunnelOrigin = process.env.DEV_TUNNEL_ORIGIN;

const nextConfig: NextConfig = {
  ...(devTunnelOrigin
    ? { allowedDevOrigins: [devTunnelOrigin] }
    : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      ...(supabaseImageHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseImageHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: cloudinaryImageHostname,
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
