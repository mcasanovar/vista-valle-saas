import "server-only";

import { getServerEnvironment } from "@/config/server";

export type CompanyContactChannel = Readonly<{
  href: `mailto:${string}` | `tel:${string}` | `https://${string}`;
  label: string;
}>;

export type CompanyEnquiryPath =
  | Readonly<{ kind: "demo" }>
  | Readonly<{ kind: "contact"; contact: CompanyContactChannel }>
  | Readonly<{ kind: "pending" }>;

export function createCompanyEnquiryPath(
  context: "mock" | "production",
  contact?: CompanyContactChannel
): CompanyEnquiryPath {
  if (context === "mock") {
    return Object.freeze({ kind: "demo" });
  }

  return contact
    ? Object.freeze({ kind: "contact", contact })
    : Object.freeze({ kind: "pending" });
}

export function getCompanyEnquiryPath(
  contact?: CompanyContactChannel
): CompanyEnquiryPath {
  return createCompanyEnquiryPath(
    getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT,
    contact
  );
}
