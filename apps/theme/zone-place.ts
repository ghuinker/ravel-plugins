// Where on Earth a time zone is, close enough for sunrise and sunset: the zone's main city, or for a zone not listed, its offset's
// meridian at a mid-northern latitude (off by up to a few tens of minutes, which is fine for switching the theme).
import { zoneOffset } from "../../lib/time.ts";

export type Place = { lat: number; lon: number };

const PLACES: Record<string, [number, number]> = {
  "America/Denver": [39.74, -104.99], "America/Boise": [43.62, -116.2], "America/Edmonton": [53.55, -113.49], "America/Phoenix": [33.45, -112.07],
  "America/New_York": [40.71, -74.01], "America/Chicago": [41.88, -87.63], "America/Los_Angeles": [34.05, -118.24], "America/Anchorage": [61.22, -149.9],
  "Pacific/Honolulu": [21.31, -157.86], "America/Toronto": [43.65, -79.38], "America/Vancouver": [49.28, -123.12], "America/Halifax": [44.65, -63.58],
  "America/Mexico_City": [19.43, -99.13], "America/Bogota": [4.71, -74.07], "America/Sao_Paulo": [-23.55, -46.63], "America/Argentina/Buenos_Aires": [-34.6, -58.38],
  "America/Santiago": [-33.45, -70.67], "America/Lima": [-12.05, -77.04],
  "Europe/London": [51.51, -0.13], "Europe/Dublin": [53.35, -6.26], "Europe/Lisbon": [38.72, -9.14], "Europe/Paris": [48.86, 2.35], "Europe/Berlin": [52.52, 13.4],
  "Europe/Zurich": [47.37, 8.54], "Europe/Madrid": [40.42, -3.7], "Europe/Rome": [41.9, 12.5], "Europe/Amsterdam": [52.37, 4.9], "Europe/Vienna": [48.21, 16.37],
  "Europe/Prague": [50.08, 14.44], "Europe/Warsaw": [52.23, 21.01], "Europe/Copenhagen": [55.68, 12.57], "Europe/Oslo": [59.91, 10.75], "Europe/Stockholm": [59.33, 18.07],
  "Europe/Helsinki": [60.17, 24.94], "Europe/Athens": [37.98, 23.73], "Europe/Istanbul": [41.01, 28.98], "Europe/Moscow": [55.76, 37.62],
  "Africa/Cairo": [30.04, 31.24], "Africa/Johannesburg": [-26.2, 28.05], "Africa/Lagos": [6.52, 3.38], "Africa/Nairobi": [-1.29, 36.82],
  "Asia/Jerusalem": [31.77, 35.21], "Asia/Dubai": [25.2, 55.27], "Asia/Karachi": [24.86, 67.01], "Asia/Kolkata": [19.08, 72.88], "Asia/Bangkok": [13.76, 100.5],
  "Asia/Jakarta": [-6.21, 106.85], "Asia/Singapore": [1.35, 103.82], "Asia/Hong_Kong": [22.32, 114.17], "Asia/Shanghai": [31.23, 121.47], "Asia/Taipei": [25.03, 121.57],
  "Asia/Manila": [14.6, 120.98], "Asia/Seoul": [37.57, 126.98], "Asia/Tokyo": [35.68, 139.69],
  "Australia/Perth": [-31.95, 115.86], "Australia/Brisbane": [-27.47, 153.03], "Australia/Sydney": [-33.87, 151.21], "Australia/Melbourne": [-37.81, 144.96],
  "Pacific/Auckland": [-36.85, 174.76],
};

export function placeOf(zone: string, at = Date.now()): Place {
  const known = PLACES[zone];
  if (known) return { lat: known[0], lon: known[1] };
  return { lat: 40, lon: zoneOffset(at, zone) / 3_600_000 * 15 };
}
