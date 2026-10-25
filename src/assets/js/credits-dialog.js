(() => {
  const dialog = document.querySelector("[data-credits-dialog]") || document.querySelector("#credits-dialog");
  const openButton = document.querySelector("[data-credits-open]");

  if (!(dialog instanceof HTMLDialogElement) || !(openButton instanceof HTMLButtonElement)) {
    return;
  }

  openButton.addEventListener("click", () => {
    dialog.showModal();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
})();
