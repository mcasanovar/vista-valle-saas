"use client";

import { motion } from "framer-motion";
import { Heading, Icon, type IconName, Text } from "@/presentation/atoms";
import { usePublicReducedMotion } from "./motion";
export function Services({
  title,
  items,
  id,
  emptyMessage,
}: {
  title: string;
  id?: string;
  emptyMessage?: string;
  items: readonly {
    id: string;
    title: string;
    description: string;
    icon: IconName;
  }[];
}) {
  const shouldReduceMotion = usePublicReducedMotion();
  const animated = !shouldReduceMotion;
  return (
    <section
      id={id}
      className="mx-auto max-w-content space-y-7 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <div className="max-w-prose">
        <Heading>{title}</Heading>
      </div>
      {items.length ? (
        <ul className="grid gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              data-motion={animated ? "enabled" : "reduced"}
              initial={animated ? { opacity: 0, y: 16 } : false}
              animate={animated ? { opacity: 1, y: 0 } : undefined}
              whileHover={animated ? { y: -4 } : undefined}
              transition={{
                duration: 0.3,
                delay: animated ? Math.min(index * 0.06, 0.18) : 0,
                ease: [0.2, 0, 0, 1],
              }}
              className="space-y-3 rounded-xl border bg-card p-5 shadow-sm"
            >
              <Icon decorative name={item.icon} />
              <Heading level={3}>{item.title}</Heading>
              <Text className="text-muted-foreground">{item.description}</Text>
            </motion.li>
          ))}
        </ul>
      ) : emptyMessage ? (
        <Text className="text-muted-foreground">{emptyMessage}</Text>
      ) : null}
    </section>
  );
}
