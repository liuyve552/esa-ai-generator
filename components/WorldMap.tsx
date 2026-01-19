"use client";

import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";

// Fix Leaflet default icon path for Next.js static export
if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
  });
}

const userIcon = L.divIcon({
  className: "user-pin",
  html:
    '<div style="width:14px;height:14px;border-radius:999px;background:#7c3aed;box-shadow:0 0 0 4px rgba(124,58,237,0.25)"></div>'
});

const edgeIcon = L.divIcon({
  className: "edge-pin",
  html:
    '<div style="width:10px;height:10px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,0.18)"></div>'
});

export default function WorldMap({
  latitude,
  longitude,
  city
}: {
  latitude: number;
  longitude: number;
  city?: string;
}) {
  const { t } = useTranslation();
  const center = useMemo<LatLngExpression>(() => [latitude, longitude], [latitude, longitude]);

  const edgeNodes = useMemo(
    () =>
      [
        { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
        { name: "Singapore", lat: 1.3521, lon: 103.8198 },
        { name: "Frankfurt", lat: 50.1109, lon: 8.6821 },
        { name: "Virginia", lat: 37.4316, lon: -78.6569 },
        { name: "San Francisco", lat: 37.7749, lon: -122.4194 }
      ] as const,
    []
  );

  return (
    <MapContainer center={center} zoom={2} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      {/* 使用 CartoDB 瓦片服务（国内访问更稳定） */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
        maxZoom={20}
      />

      <Marker position={center} icon={userIcon}>
        <Popup>{city ? t("map.youAreNear", { city }) : t("map.yourLocation")}</Popup>
      </Marker>

      <CircleMarker center={center} radius={18} pathOptions={{ color: "#7c3aed", weight: 1, opacity: 0.35 }} />

      {edgeNodes.map((n) => (
        <Marker key={n.name} position={[n.lat, n.lon]} icon={edgeIcon}>
          <Popup>{t("map.edgeNode", { name: n.name })}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
