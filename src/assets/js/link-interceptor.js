(() => {
  const openInCurrentPage = (href) => {
    window.location.assign(href);
  };

  const openInNewPage = (href) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const link = event.target.closest("[data-link-confirm]");

    if (!(link instanceof HTMLAnchorElement) || event.defaultPrevented) {
      return;
    }

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !window.Swal
    ) {
      return;
    }

    event.preventDefault();

    const linkPreview = [
      link.dataset.linkTitle,
      link.dataset.linkUrl || link.href,
      link.dataset.linkDescription,
    ]
      .filter(Boolean)
      .join("\n");

    window.Swal.fire({
      title: "Abrir link?",
      text: linkPreview,
      icon: "question",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Abrir nesta página",
      denyButtonText: "Abrir em nova página",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        openInCurrentPage(link.href);
      }

      if (result.isDenied) {
        openInNewPage(link.href);
      }
    });
  });
})();
