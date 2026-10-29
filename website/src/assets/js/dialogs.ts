(() => {
  document.addEventListener('click', (event: MouseEvent) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const opener = event.target.closest<HTMLElement>('[data-dialog-open]');

    const dialogID = opener?.dataset.dialogOpen;

    if (opener && dialogID) {
      const dialog = document.getElementById(dialogID);

      if (!(dialog instanceof HTMLDialogElement)) {
        return;
      }

      event.preventDefault();

      if (!dialog.open) {
        dialog.showModal();
      }

      return;
    }

    if (
      event.target instanceof HTMLDialogElement &&
      event.target.open &&
      event.target.matches('.app-dialog')
    ) {
      event.target.close();
    }
  });
})();
