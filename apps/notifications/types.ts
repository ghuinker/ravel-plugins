import { plugsFor } from "../../lib/plugs.ts";

// The registry: every notification the site may send. A notification whose `thread` is not one of these ids is dropped by the gate.
export type NotificationType = {
  id: string;
  app: string;
  label: string;
  hint: string;
  /** Whether it is on until the owner says otherwise. */
  fallback: boolean;
  /** Always sent when the owner asked for it (a reminder, a test). Has no switch; the master switch and quiet hours still apply. */
  asked?: boolean;
};

/** One entry of an app's `plugs.notifications` in its `app.ts`. Its id is prefixed with the app folder: `morning` in `apps/habits` is `habits.morning`. */
export type NotificationSpec = Omit<NotificationType, "app">;

const OWN: NotificationType[] = [
  { id: "reminder", app: "Chat", label: "Reminders you ask for", hint: "Reminders you ask Claude to set, at the time you asked.", fallback: true, asked: true },
  { id: "test", app: "Notifications", label: "Test notification", hint: "The Send test button on this page.", fallback: true, asked: true },
];

const appLabel = (folder: string) => folder.charAt(0).toUpperCase() + folder.slice(1);

/** Every app's declared types, then the ones this app owns. */
export async function notificationTypes(): Promise<NotificationType[]> {
  const found = await plugsFor<NotificationSpec[]>("notifications");
  const declared = found.flatMap(({ app, value }) => value.map((type) => ({ ...type, id: `${app}.${type.id}`, app: appLabel(app) })));
  return [...declared, ...OWN];
}

export const typeById = async (id: string | undefined): Promise<NotificationType | undefined> =>
  id ? (await notificationTypes()).find((type) => type.id === id) : undefined;
