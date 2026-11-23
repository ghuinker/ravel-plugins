// Sunrise and sunset (NOAA's approximation, good to a minute or two) for the place a time zone stands for (see zone-place.ts).
import { type Place, placeOf } from "./zone-place.ts";

const RAD = Math.PI / 180;
const ZENITH = 90.833 * RAD;

/** Sunrise and sunset as epoch ms for the solar day containing `at` at a place. */
export function sunTimes(at: number, { lat: LAT, lon: LON }: Place): { rise: number; set: number } {
  // Solar day there: shift by longitude so the day number matches local noon.
  const noonUtc = Math.floor((at + LON / 15 * 3600000) / 86400000) * 86400000 + 12 * 3600000 - LON / 15 * 3600000;
  const days = noonUtc / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.5291 + 0.98560028 * days) * RAD;
  const center = 1.9148 * Math.sin(g) + 0.02 * Math.sin(2 * g) + 0.0003 * Math.sin(3 * g);
  const lambda = (280.46 + 0.9856474 * days + center) * RAD;
  const decl = Math.asin(Math.sin(lambda) * Math.sin(23.4393 * RAD));
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const cosH = (Math.cos(ZENITH) - Math.sin(LAT * RAD) * Math.sin(decl)) / (Math.cos(LAT * RAD) * Math.cos(decl));
  const hour = Math.acos(Math.min(1, Math.max(-1, cosH))) / RAD * 4 * 60000; // half the daylight, ms
  const solarNoon = noonUtc - eqTime * 60000;
  return { rise: solarNoon - hour, set: solarNoon + hour };
}

/** True between sunset and the next sunrise. */
export function isNight(at: number, zone: string): boolean {
  const { rise, set } = sunTimes(at, placeOf(zone, at));
  return at < rise || at >= set;
}
