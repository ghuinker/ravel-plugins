// The rich editor in the browser (`richScript()` in rich-edit.ts): Datastar attributes call these as `ravelRich.<name>`.
import { richBlock, richFocus, richFocusEnd, richImage, richInline, richLink, richLoad, richTable } from "./rich-edit.client.ts";

Object.assign(globalThis, { ravelRich: { richBlock, richFocus, richFocusEnd, richImage, richInline, richLink, richLoad, richTable } });
