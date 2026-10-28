(() => {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest?.('[data-dialog-open]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.dialogOpen);
      if (!(dialog instanceof HTMLDialogElement)) return;
      event.preventDefault();
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (
      event.target instanceof HTMLDialogElement &&
      event.target.open &&
      event.target.matches('.app-dialog')
    )
      event.target.close();
  });
})();
