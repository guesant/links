<script lang="ts">
  let { ui }: { ui: Record<string, string> } = $props();
</script>

<dialog
  id="bios-dialog"
  class="bios-dialog"
  aria-labelledby="bios-title"
  aria-describedby="bios-status"
>
  <div class="bios-screen">
    <header class="bios-header">
      <h2 id="bios-title">
        GuesantBIOS v5.0
        <br />
        Interface initialization monitor
      </h2>
      <span class="bios-status-badge">STARTUP CHECK</span>
    </header>
    <div class="bios-post" aria-hidden="true">
      <p class="bios-post-line" data-bios-step="1" hidden>
        Runtime loader : Ready
      </p>
      <p class="bios-post-line" data-bios-step="4" hidden>
        Configuration : Loaded
      </p>
      <p class="bios-post-line bios-post-muted" data-bios-step="8" hidden>
        Checking interface modules ...
      </p>
      {#each ['Navigation', 'Content index', 'User preferences', 'Display controls'] as item, index}<p
          class="bios-post-line bios-post-drive"
          data-bios-step={11 + index * 2}
          hidden
        >
          Module 0{index} : {item}
        </p>{/each}
      <p class="bios-boot-line" data-bios-boot-line hidden>
        Starting interface: <span data-bios-interface></span>
        <span data-bios-progress></span>
        <span class="bios-cursor"></span>
      </p>
    </div>
    <p class="bios-announcement" id="bios-status" role="status">
      {ui.bios_status}
    </p>
    <footer class="bios-footer">
      <button type="button" data-bios-skip>{ui.bios_skip} · Esc</button>
      <span>Automatic startup sequence</span>
    </footer>
    <p class="bios-build-stamp">LOBBY-BOOT-5.0</p>
  </div>
</dialog>
