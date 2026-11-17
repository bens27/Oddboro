// The session handoff script, from Setup: what a full chat session is asked
// to write as its notes before it hands over (chat-handoff.ts). The owner can
// read the office's own, keep their own, or go back to the office's.
import { error, json } from '@sveltejs/kit';
import { HANDOFF_SCRIPT_MAX, handoffScript, setHandoffScript } from '@oddboro/ledger';
import { isFixedError } from '@oddboro/ledger/errors';
import { CHECKPOINT_ASK } from '#lib/server/chat-handoff.ts';
import type { RequestHandler } from './$types';

const state = async () => {
  const own = await handoffScript();
  return {
    script: own ?? CHECKPOINT_ASK,
    office: CHECKPOINT_ASK,
    own: own !== null,
    max: HANDOFF_SCRIPT_MAX
  };
};

export const GET: RequestHandler = async () => json(await state());

/** `script` keeps the owner's words; null, empty, or the office's own words go back to the office's. */
export const PUT: RequestHandler = async ({ request }) => {
  const b = (await request.json().catch(() => ({}))) as { script?: unknown };
  if (b.script !== null && typeof b.script !== 'string')
    error(400, "Send a script, or null for the office's");
  const words = typeof b.script === 'string' ? b.script.trim() : '';
  try {
    await setHandoffScript(words && words !== CHECKPOINT_ASK ? words : null);
  } catch (e) {
    error(400, isFixedError(e) ? e.message : 'The script did not save.');
  }
  return json(await state());
};
