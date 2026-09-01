import { getCompanyEnquiryPath } from "@/features/company-enquiries";
import { AvailabilitySearchController } from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";
import { getServerEnvironment } from "@/config/server";
import { publicSiteContent } from "@/config/public-site-content";
import { StructuredData } from "@/presentation/organisms";
import { PublicHomeTemplate } from "@/presentation/templates";
import { createLodgingStructuredData } from "@/seo/structured-data";
import { Suspense } from "react";

export default async function HomePage() {
  const roomSource = await getRoomReadSource();
  const rooms = roomSource.listActive();
  const siteUrl = getServerEnvironment().SITE_URL;

  return (
    <>
      <Suspense fallback={<main aria-live="polite" className="min-h-screen bg-warm" />}>
        <PublicHomeTemplate
          companyEnquiry={getCompanyEnquiryPath(
            publicSiteContent.company.contact
          )}
          bookingSearch={<AvailabilitySearchController presentation="hero" />}
          rooms={rooms}
        />
      </Suspense>
      <StructuredData data={createLodgingStructuredData(siteUrl, rooms)} />
    </>
  );
}
