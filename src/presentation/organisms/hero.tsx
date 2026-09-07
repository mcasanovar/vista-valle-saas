import Image from "next/image";
import { ActionLink, Heading, Text } from "@/presentation/atoms";
import { InteractiveSurface } from "./motion";

export function Hero({
  eyebrow,
  title,
  copy,
  primaryCta,
  secondaryCta,
  image,
}: {
  eyebrow?: string;
  title: string;
  copy: string;
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  image?: { src: string; alt: string };
}) {
  if (image && (!image.src.trim() || !image.alt.trim()))
    throw new Error("Hero image source and alt are required");
  return (
    <section className="vv-hero relative isolate overflow-hidden bg-background">
      {image ? (
        <div className="vv-hero-media relative overflow-hidden">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority
            sizes="(min-width: 64rem) 55vw, 100vw"
            className="object-cover"
          />
          <span className="vv-hero-caption">Hospedaje con vista al valle</span>
        </div>
      ) : (
        <div aria-hidden="true" className="vv-hero-media vv-hero-visual" />
      )}
      <div className="vv-hero-copy relative mx-auto flex max-w-content items-center px-4 py-12 phone:px-6 tablet:px-8 tablet:py-16 laptop:px-0">
        <div className="max-w-2xl space-y-5 text-left">
          {eyebrow && (
            <Text className="!text-label font-semibold uppercase tracking-[0.18em] !text-accent">
              {eyebrow}
            </Text>
          )}
          <Heading level={1} className="vv-hero-title">
            {title}
          </Heading>
          <Text className="max-w-lg text-muted-foreground">{copy}</Text>
          <div className="flex flex-wrap justify-start gap-3">
            <InteractiveSurface>
              <ActionLink
                href={primaryCta.href}
                variant="action"
                className="!bg-primary !font-heading !font-semibold !text-on-primary hover:!bg-primary active:!bg-primary"
              >
                {primaryCta.label}
              </ActionLink>
            </InteractiveSurface>
            {secondaryCta && (
              <ActionLink
                href={secondaryCta.href}
                className="inline-flex min-h-11 items-center rounded-md border border-primary bg-transparent px-4 py-2 !text-primary no-underline hover:bg-primary hover:!text-on-primary active:bg-primary active:!text-on-primary"
              >
                {secondaryCta.label}
              </ActionLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
