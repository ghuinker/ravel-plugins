// What the theme gives the design system (plugged in from app.ts): its CSS, iOS tokens, scenery and thread colours.
import type { Skin } from "@app/design-system/api.ts";
import { themeClient, themeCss, themeThread, themeTokens } from "./site-theme.ts";

export const skin: Skin = { css: themeCss, tokens: themeTokens, client: themeClient, thread: themeThread };
