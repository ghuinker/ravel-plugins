// The router leaves the layout in place, so the tab for the new page lights up here instead of in a re-render.
const under = (path: string, base: string) => path === base || (base !== "/" && path.startsWith(`${base}/`));

function markActiveTab(path: string) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-tab-bar] a[href]")) {
    // data-nav-also: other paths that belong to this tab (Forward covers Goals, Habits and Workouts).
    const bases = [new URL(link.href).pathname, ...(link.dataset.navAlso ?? "").split(" ").filter(Boolean)];
    const active = bases.some((base) => under(path, base));
    link.classList.toggle("t-active", active);
    link.classList.toggle("t-muted", !active);
  }
  // More lights up when a link in its popup (or a tab hidden at this width) is the current page.
  for (const button of document.querySelectorAll<HTMLElement>("[data-tab-bar] [data-more]")) {
    const popup = button.nextElementSibling;
    const active = [...(popup?.querySelectorAll("a.t-active") ?? [])].length > 0;
    button.classList.toggle("t-active", active);
    button.classList.toggle("t-muted", !active);
  }
}

addEventListener("ravel-navigate", (event) => markActiveTab((event as CustomEvent<{ path: string }>).detail.path));
