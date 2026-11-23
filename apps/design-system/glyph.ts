import { html, type Raw } from "@ravel/html.ts";
import { icon, isIcon } from "@ravel/icons.ts";

/** A Heroicon (outline) when `name` is one, otherwise nothing: old emoji kept in the database never show. Use it for ⋮ menu items only; the site doesn't decorate rows, tiles or chips. */
export const glyph = (name: string | null | undefined, cls = "size-5"): Raw | string => (name && isIcon(name) ? icon(name, cls) : "");
