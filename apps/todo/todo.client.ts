// Todo's browser script, run while the page parses: Datastar attributes call these as `todoView.<name>`.
import {
  addPhotos, addSubtask, dateValue, edit, field, hasTag, hasUnsorted, hint, isBlank, listHTML, moveTo, noTags, openTask, parseLines, pastePhotos, payload, photos,
  priorityValue, quickDue, removePhoto, repeatInput, repeatValue, save, setDoneOpen, setNotes, setRepeat, setTaskRef, tagValue, toggle, toggled, toggleTag, withExtras,
} from "./list.ts";

setTaskRef((globalThis.document?.currentScript as HTMLScriptElement | null | undefined)?.dataset.task ?? "");

Object.assign(globalThis, {
  todoView: {
    addPhotos, addSubtask, dateValue, edit, field, hasTag, hasUnsorted, hint, isBlank, listHTML, moveTo, noTags, openTask, parseLines, pastePhotos, payload, photos,
    priorityValue, quickDue, removePhoto, repeatInput, repeatValue, save, setDoneOpen, setNotes, setRepeat, tagValue, toggle, toggled, toggleTag, withExtras,
  },
});
