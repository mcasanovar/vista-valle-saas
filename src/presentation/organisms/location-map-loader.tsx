"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/presentation/atoms";
import type { LocationMapProps } from "./location-map";

const LocationMap = dynamic(() => import("./location-map"), {
  ssr: false,
  // The Leaflet/react-leaflet chunk is heavy enough that its download can
  // take a moment even after the page itself is interactive — without this,
  // the map area is a blank gap until the chunk resolves.
  loading: () => (
    <Skeleton className="h-[24rem] w-full rounded-lg tablet:h-[28rem]" />
  ),
});

export function LocationMapLoader(props: LocationMapProps) {
  return <LocationMap {...props} />;
}
