import { appModules } from "@ravel/apps.ts";
import { state } from "./define.ts";

const kv = state(import.meta);
const space = Deno.env.get("RAVEL_SPACE") ?? Deno.cwd();
const key = (name: string) => `job-off.${name}`;

export const jobEnabled = (name: string) => kv.get(key(name)) !== "1";

/** An app's jobs minus the ones switched off, for its `app.ts`: `export const jobs = {...}` and `jobs: enabledJobs(jobs)`. */
export const enabledJobs = (jobs: Record<string, string>) => Object.fromEntries(Object.entries(jobs).filter(([name]) => jobEnabled(name)));

export type JobFile = { name: string; app: string; path: string; description: string };

const DESCRIPTION_LINE = /^\/\/\s*(.+)/;

/** A job's description is the `//` comment on its first line. */
export function describeJob(source: string): string {
  return source.split("\n")[0].match(DESCRIPTION_LINE)?.[1] ?? "";
}

function readDescription(path: string): string {
  try {
    return describeJob(Deno.readTextFileSync(`${space}/${path}.ts`));
  } catch {
    return "";
  }
}

// Each app's app.ts exports all its jobs as `jobs`, switched off or not. Read on call: app.ts files import this kit.
/** Every job in the space, by name. */
export async function listJobs(): Promise<JobFile[]> {
  const found = (await appModules<{ jobs?: Record<string, string> }>("app.ts"))
    .flatMap(({ app, mod }) => Object.entries(mod.jobs ?? {}).map(([name, file]) => ({ name, app, path: `apps/${app}/${file.replace(/^\.\//, "")}` })));
  return found.sort((a, b) => a.name.localeCompare(b.name)).map((job) => ({ ...job, description: readDescription(job.path) }));
}

export const isJobName = async (name: string) => (await listJobs()).some((job) => job.name === name);

/** Switches a job on or off and re-saves the app.ts that registers it, so Ravel drops or restores its schedule. */
export async function setJobEnabled(name: string, on: boolean): Promise<boolean> {
  const job = (await listJobs()).find((candidate) => candidate.name === name);
  if (!job) return false;
  kv.set(key(name), on ? "0" : "1");
  await Deno.utime(`${space}/apps/${job.app}/app.ts`, new Date(), new Date());
  return true;
}
