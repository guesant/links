<script>
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';

  let { children } = $props();

  afterNavigate(() => {
    const data = page.data;
    if (data.interfaceName) {
      document.documentElement.dataset.interface = data.interfaceName;
      document.documentElement.dataset.page = data.page.id;
      document.documentElement.lang = data.localized.ui.html_lang;
      document.body.className =
        data.interfaceName === 'terminal'
          ? 'terminal-interface'
          : 'theme-minecraft appearance-system background-default';
    }
    requestAnimationFrame(() =>
      document.dispatchEvent(new Event('lobby:navigate')),
    );
  });
</script>

{@render children()}
