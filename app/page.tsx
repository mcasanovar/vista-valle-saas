import { getCompanyEnquiryPath } from "@/features/company-enquiries";
import { AvailabilitySearchController } from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";
import { getServerEnvironment } from "@/config/server";
import { publicSiteContent } from "@/config/public-site-content";
import { StructuredData } from "@/presentation/organisms";
import { PublicHomeTemplate } from "@/presentation/templates";
import {
  createFaqStructuredData,
  createLodgingStructuredData,
} from "@/seo/structured-data";

export default async function HomePage() {
  const roomSource = await getRoomReadSource();
  const rooms = roomSource.listActive();
  const siteUrl = getServerEnvironment().SITE_URL;
  const faq = createFaqStructuredData();

  return (
    <>
      <PublicHomeTemplate
        companyEnquiry={getCompanyEnquiryPath(
          publicSiteContent.company.contact
        )}
        bookingSearch={<AvailabilitySearchController presentation="hero" />}
        rooms={rooms}
      />
      <StructuredData data={createLodgingStructuredData(siteUrl, rooms)} />
      {faq ? <StructuredData data={faq} /> : null}
    </>
  );
}
