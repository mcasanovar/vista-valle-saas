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
    <section className="vv-hero relative isolate overflow-hidden bg-primary">
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div aria-hidden="true" className="vv-hero-visual absolute inset-0" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgb(15 13 11 / 0.85) 0%, rgb(15 13 11 / 0.55) 30%, rgb(15 13 11 / 0.12) 56%, transparent 72%), linear-gradient(0deg, rgb(15 13 11 / 0.35) 0%, transparent 45%)",
        }}
      />
      <div className="relative mx-auto flex min-h-96 max-w-content items-center px-4 py-10 phone:px-6 tablet:min-h-[27rem] tablet:px-8 tablet:py-12 laptop:min-h-[34rem] laptop:px-12 laptop:py-14">
        <div className="max-w-xl space-y-5 text-left">
          {eyebrow && (
            <Text className="!text-label font-semibold uppercase tracking-[0.16em] !text-gold">
              {eyebrow}
            </Text>
          )}
          <Heading level={1} className="!text-on-primary">
            {title}
          </Heading>
          <Text className="max-w-lg !text-on-primary/85">{copy}</Text>
          <div className="flex flex-wrap justify-start gap-3">
            <InteractiveSurface>
              <ActionLink
                href={primaryCta.href}
                variant="action"
                className="!bg-gold !text-on-gold hover:!bg-gold active:!bg-gold"
              >
                {primaryCta.label}
              </ActionLink>
            </InteractiveSurface>
            {secondaryCta && (
              <ActionLink
                href={secondaryCta.href}
                className="inline-flex min-h-11 items-center rounded-md border border-on-primary/50 bg-transparent px-4 py-2 !text-on-primary no-underline hover:bg-on-primary hover:!text-primary active:bg-on-primary active:!text-primary"
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
