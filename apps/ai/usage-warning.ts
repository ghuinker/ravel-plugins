import { usage } from "@ravel/claude.ts";

const WARN_PERCENT = 90;

const FULL_PERCENT = 100;

type Limit = { percent: number; resetsAt?: string } | null;

type Limits = { session?: Limit; week?: Limit; opus?: Limit; sonnet?: Limit; usingCredits?: boolean };

export type HighLimit = { label: string; percent: number; resetsAt?: string; credits?: true };

/** Limits at or above 90%; the browser adds the reset time so it's in the owner's timezone. */
export function highLimits(limits: Limits): HighLimit[] {
  const labels = { session: "5-hour session", week: "weekly", opus: "Opus weekly", sonnet: "Sonnet weekly" };
  return Object.entries(labels).flatMap(([key, label]) => {
    const limit = limits[key as keyof typeof labels];
    if (!limit || limit.percent < WARN_PERCENT) return [];
    const credits = limits.usingCredits && limit.percent >= FULL_PERCENT;
    return [{ label, percent: Math.round(limit.percent), resetsAt: limit.resetsAt, ...(credits && { credits: true as const }) }];
  });
}

export async function readUsageLimits(): Promise<HighLimit[]> {
  try {
    return highLimits(await usage());
  } catch {
    return [];
  }
}
