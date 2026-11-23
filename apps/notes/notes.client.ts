// Notes' browser script, run while the page parses: Datastar attributes call these as `notesView.<name>`.
import { addTitle, count, dropBlank, edit, editedAt, field, firstLineLong, hasTag, leaving, listHTML, longFirst, noTags, savedView, saveView, tagCount, tagValue, toggleTag } from "./list.ts";

Object.assign(globalThis, {
  notesView: {
    addTitle, count, dropBlank, edit, editedAt, field, firstLineLong, hasTag, leaving, listHTML, longFirst, noTags, savedView, saveView, tagCount, tagValue, toggleTag,
  },
});

// iOS slides the page up when the keyboard opens, which hides the top of a short note behind the native bar.
// While the caret is still in the visible part above the keyboard, put the page back at the top.
function keepTopVisible() {
  const editing = document.querySelector(".notes-editor.is-editing");
  const viewport = globalThis.visualViewport;
  if (!editing || !viewport || (scrollY <= 0 && viewport.offsetTop <= 0)) return;
  const range = getSelection()?.rangeCount ? getSelection()!.getRangeAt(0) : null;
  const caret = range && (range.getClientRects()[0] ?? (range.startContainer as Element).getBoundingClientRect?.());
  const caretY = caret ? caret.bottom + scrollY : 0;
  if (caretY < viewport.height - 40) scrollTo(0, 0);
}
if (typeof document !== "undefined") {
  const later = () => { setTimeout(keepTopVisible, 50); setTimeout(keepTopVisible, 350); };
  document.addEventListener("focusin", later);
  globalThis.visualViewport?.addEventListener("resize", later);
  globalThis.visualViewport?.addEventListener("scroll", keepTopVisible);
}
