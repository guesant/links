(() => {
  const root = document.documentElement;
  const key = "guesant-lobby-interface";
  const interfaces = new Set(["minecraft", "terminal"]);
  let selected = "minecraft";
  try {
    const saved = localStorage.getItem(key);
    if (interfaces.has(saved)) selected = saved;
  } catch {}
  root.dataset.interface = selected;
  root.dataset.interfaceReady = "true";
  const url = new URL(location.href);
  const reboot = url.searchParams.get("lobby-boot") === "1";
  if (reboot) {
    url.searchParams.delete("lobby-boot");
    history.replaceState(null, "", url.href);
  }
  document.addEventListener("DOMContentLoaded", () => {
    const bios = document.querySelector("#bios-dialog");
    let timer;
    let previous;
    const reduced = () =>
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      root.dataset.motion === "off";
    function finish() {
      clearTimeout(timer);
      timer = undefined;
      if (bios?.open) bios.close();
      if (previous?.isConnected && !previous.closest("dialog:not([open])"))
        previous.focus();
      else if (previous) document.querySelector(".navigation-home")?.focus();
      previous = undefined;
    }
    function boot() {
      if (!bios || reduced() || typeof bios.showModal !== "function") return;
      previous = document.activeElement;
      for (const dialog of document.querySelectorAll("dialog[open]"))
        if (dialog !== bios) dialog.close();
      clearTimeout(timer);
      bios.querySelector("[data-bios-interface]").textContent =
        root.dataset.interface === "terminal" ? "Terminal" : "Minecraft";
      bios.showModal();
      timer = setTimeout(finish, 2000);
    }
    function sync() {
      for (const option of document.querySelectorAll("[data-interface-option]"))
        option.checked = option.value === root.dataset.interface;
    }
    sync();
    document.addEventListener("change", (event) => {
      const option = event.target;
      if (
        !(option instanceof HTMLInputElement) ||
        !option.matches("[data-interface-option]") ||
        !option.checked ||
        !interfaces.has(option.value)
      )
        return;
      const old = root.dataset.interface;
      root.dataset.interface = option.value;
      try {
        localStorage.setItem(key, option.value);
      } catch {}
      sync();
      if (old !== "terminal" && option.value === "terminal") boot();
    });
    bios?.querySelector("[data-bios-skip]")?.addEventListener("click", finish);
    bios?.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish();
    });
    document.addEventListener("change", () => {
      if (bios?.open && reduced()) finish();
    });
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("[data-reboot]");
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      const target = new URL(location.href);
      target.searchParams.set("lobby-boot", "1");
      location.assign(target.href);
    });
    if (reboot) boot();
  });
})();
