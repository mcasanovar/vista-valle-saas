"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";

export type LocationMapPoint = Readonly<{
  position: readonly [number, number];
  label: string;
}>;

export type LocationMapProps = Readonly<{
  hostal: LocationMapPoint;
  plazaDeArmas: LocationMapPoint;
  route: readonly (readonly [number, number])[];
}>;

// Inline SVG pins (no external image request) so the OSM CSP allowance stays
// scoped to tiles only — Leaflet's own default marker icons load from
// relative asset paths that don't survive a webpack/Next.js bundle.
function createPinIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0Z" fill="${color}" />
      <circle cx="14" cy="14" r="6" fill="white" />
    </svg>
  `;
  return L.divIcon({
    className: "vv-map-pin",
    html: svg,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -34],
  });
}

const hostalIcon = createPinIcon("var(--color-gold, #d9a441)");
const plazaIcon = createPinIcon("var(--color-primary, #1c1917)");

export function LocationMap({ hostal, plazaDeArmas, route }: LocationMapProps) {
  return (
    <MapContainer
      center={hostal.position as [number, number]}
      zoom={16}
      scrollWheelZoom={false}
      className="vv-location-map h-[24rem] w-full rounded-lg tablet:h-[28rem]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={hostal.position as [number, number]} icon={hostalIcon}>
        <Popup>{hostal.label}</Popup>
      </Marker>
      <Marker position={plazaDeArmas.position as [number, number]} icon={plazaIcon}>
        <Popup>{plazaDeArmas.label}</Popup>
      </Marker>
      <Polyline
        positions={route as [number, number][]}
        pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }}
      />
    </MapContainer>
  );
}

export default LocationMap;
