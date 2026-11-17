<script lang="ts">
  import { call } from './api.ts';

  // The Setup window's Session handoff section: the words a full chat session
  // is asked to write as its notes before a fresh one takes over. The owner
  // reads the office's own, changes them, or goes back to them. It loads only
  // when opened.
  type Handoff = { script: string; office: string; own: boolean; max: number };

  let open = $state(false);
  let saved = $state<Handoff | undefined>();
  let text = $state('');
  let busy = $state(false);
  let problem = $state('');
  let note = $state('');

  const changed = $derived(!!saved && text.trim() !== saved.script.trim());
  const tooLong = $derived(!!saved && text.trim().length > saved.max);

  async function show() {
    open = !open;
    if (!open || saved) return;
    problem = '';
    try {
      saved = await call<Handoff>('/api/setup/handoff');
      text = saved.script;
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
  }

  async function keep(script: string | null) {
    busy = true;
    problem = '';
    note = '';
    try {
      saved = await call<Handoff>('/api/setup/handoff', { script }, 'PUT');
      text = saved.script;
      note = saved.own
        ? 'Saved. The next handover uses your script.'
        : 'Back to the office’s script.';
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  const button =
    'rounded-lg bg-raise px-3 py-2 text-xs font-medium hover:bg-sea/20 disabled:opacity-40';
</script>

<section class="flex flex-col gap-2 text-xs" aria-label="Session handoff">
  <div class="flex items-center">
    <h3 class="flex-1 tracking-[0.16em] text-sea uppercase">Session handoff</h3>
    <button
      class="text-xs text-sea underline underline-offset-2"
      aria-expanded={open}
      onclick={show}>{open ? 'Hide script' : 'Show script'}</button
    >
  </div>
  <p class="text-muted">
    When an Odd’s chat gets too long, it writes notes for itself and starts fresh with them. This is
    what it is asked to write.
    {#if saved}{saved.own
        ? 'You are using your own script.'
        : 'You are using the office’s script.'}{/if}
  </p>
  {#if open && saved}
    <textarea
      rows="14"
      class="resize-y rounded-lg bg-night/60 px-3 py-2 font-mono text-xs outline-none"
      aria-label="Session handoff script"
      bind:value={text}
      oninput={() => (note = '')}></textarea>
    <p class="text-faint">
      {'{owner}'} becomes your name. {text.trim().length.toLocaleString()} of {saved.max.toLocaleString()}
      characters.
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        class={button}
        disabled={busy || !changed || tooLong || !text.trim()}
        onclick={() => keep(text)}>Save</button
      >
      {#if changed}
        <button class={button} disabled={busy} onclick={() => saved && (text = saved.script)}
          >Undo changes</button
        >
      {/if}
      {#if saved.own || text.trim() !== saved.office.trim()}
        <button class={button} disabled={busy} onclick={() => keep(null)}>Restore default</button>
      {/if}
    </div>
    {#if tooLong}
      <p class="text-coral" role="alert">
        Keep the script under {saved.max.toLocaleString()} characters.
      </p>
    {/if}
    {#if note}
      <p class="text-muted" aria-live="polite">{note}</p>
    {/if}
  {/if}
  {#if problem}
    <p class="rounded-lg bg-coral/15 px-3 py-2 text-coral" role="alert">{problem}</p>
  {/if}
</section>
