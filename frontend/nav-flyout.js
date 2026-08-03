/**
 * Flyout lateral tipo Workday: hover/clic para abrir, clic fuera o Escape para cerrar.
 * El panel usa position:fixed para no quedar bajo capas del layout.
 */
function setupSideFlyout({ group, button, flyout, onSelect }) {
  let closeTimer = null;
  let isOpen = false;

  function place() {
    const r = button.getBoundingClientRect();
    const gap = 10;
    let top = r.top;
    const maxTop = window.innerHeight - flyout.offsetHeight - 12;
    if (flyout.offsetHeight > 0 && top > maxTop) top = Math.max(12, maxTop);
    flyout.style.left = `${Math.round(r.right + gap)}px`;
    flyout.style.top = `${Math.round(top)}px`;
  }

  function openFlyout() {
    clearTimeout(closeTimer);
    group.classList.add("open");
    flyout.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
    isOpen = true;
    place();
    // recolocar tras pintar (altura real del panel)
    requestAnimationFrame(place);
  }

  function closeFlyout() {
    clearTimeout(closeTimer);
    group.classList.remove("open");
    flyout.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
    isOpen = false;
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeFlyout, 220);
  }

  button.addEventListener("mouseenter", openFlyout);
  button.addEventListener("mouseleave", scheduleClose);
  flyout.addEventListener("mouseenter", () => {
    clearTimeout(closeTimer);
    openFlyout();
  });
  flyout.addEventListener("mouseleave", scheduleClose);

  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (isOpen) closeFlyout();
    else openFlyout();
  });

  document.addEventListener("click", (ev) => {
    if (!isOpen) return;
    if (button.contains(ev.target) || flyout.contains(ev.target)) return;
    closeFlyout();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeFlyout();
  });

  window.addEventListener("resize", () => {
    if (isOpen) place();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (isOpen) place();
    },
    true
  );

  flyout.querySelectorAll("[data-section]").forEach((link) => {
    link.addEventListener("click", (ev) => {
      if (typeof onSelect === "function") {
        ev.preventDefault();
        onSelect(link.dataset.section);
      }
      closeFlyout();
    });
  });

  // enlaces <a href> en home: cerrar al navegar
  flyout.querySelectorAll("a.flyout-link").forEach((link) => {
    link.addEventListener("click", () => closeFlyout());
  });

  return { openFlyout, closeFlyout, place };
}
