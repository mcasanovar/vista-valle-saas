import { describe, expect, it } from "vitest";
import { buildStayFaq, publicFaq, publicSiteContent } from "@/config/public-site-content";

describe("buildStayFaq", () => {
  it("includes no question for a field left out of the input", () => {
    const faq = buildStayFaq({});
    expect(faq).toEqual([]);
  });

  it("includes only the questions whose data is confirmed", () => {
    const faq = buildStayFaq({ wifi: "Wi-Fi gratuito." });
    expect(faq).toHaveLength(1);
    expect(faq[0].id).toBe("wifi");
  });

  it("requires both check-in and check-out to publish that question", () => {
    expect(buildStayFaq({ checkInTime: "15:00" })).toEqual([]);
    expect(buildStayFaq({ checkOutTime: "12:00" })).toEqual([]);
    expect(
      buildStayFaq({ checkInTime: "15:00", checkOutTime: "12:00" })
    ).toHaveLength(1);
  });

  it("publishes a pets question even when pets are not accepted", () => {
    const faq = buildStayFaq({ petsAllowed: false });
    expect(faq).toHaveLength(1);
    expect(faq[0].answer).toContain("No");
  });
});

describe("publicFaq", () => {
  it("is derived from the confirmed stayPolicies and omits breakfast", () => {
    expect(publicFaq.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["check-in-out", "parking", "pets", "wifi"])
    );
    expect(publicFaq.some((entry) => entry.id === "breakfast")).toBe(false);
  });

  it("matches the confirmed public-site-content stayPolicies", () => {
    expect(publicFaq).toEqual(buildStayFaq(publicSiteContent.stayPolicies));
  });
});
