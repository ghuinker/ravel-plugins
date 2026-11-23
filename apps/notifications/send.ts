import { notify, type Notification } from "@ravel/notify.ts";
import { verdictFor } from "./db.ts";

/** Every notification in the site goes through here. The `thread` is the registered type id; `gate` (the hook in the root app.ts) does the blocking and logging. */
export const send = (type: string, note: Omit<Notification, "thread">) => notify({ ...note, thread: type });

/** For jobs: would a notification of this type go out right now? Check before spending a one-time reminder on it. */
export const canSendNow = async (type: string) => (await verdictFor(type)).send;
