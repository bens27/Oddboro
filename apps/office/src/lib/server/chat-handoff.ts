// A chat session that has grown nearly full hands over to a fresh one. Before
// the next reply, the Odd writes notes for itself in the full session; the
// office keeps them in the Odd's folder (checkpoint.md, one of the office's
// own files) and ends the session, and the fresh session's first message
// starts with them, before the latest of the chat word for word.
import { readFileSync, rmSync } from 'node:fs';
import { chatSession, handoffScript, home, OFFICE_FILES, type StaffRow } from '@oddboro/ledger';
import { replace } from './launch.ts';
import { parseSession } from './resume.ts';
import { run, runHomeOf } from './staff.ts';

/**
 * How full a chat session may get, in tokens, before it hands over. One
 * number for every tool and model: below the point where Claude Code starts
 * compacting a 200k window on its own, and well inside Codex's.
 */
export const HANDOFF_TOKENS = 120_000;

/** The most of the notes the next session is given, in characters. */
export const CHECKPOINT_MAX = 16_000;

const checkpointOf = (id: string) => home('staff', id, OFFICE_FILES.checkpoint);

/**
 * What the full session is asked to write, unless the owner wrote their own in
 * Setup (`handoffScript`). Its whole reply is the notes.
 */
export const CHECKPOINT_ASK = `(Office note: this chat session is nearly full, so the office starts you a fresh one before your next reply. The fresh session will not remember this one. It gets the latest of the chat word for word, and the notes you write now. {owner} never sees them.

Write the notes as your whole reply, in these sections:

## Objective
What {owner} wants from you in this chat, in their words where you can.

## Current state
What is done, what is under way, and where each piece is: files, tasks, threads.

## Open items
Every promise, question and piece of work still open, and who it waits on. Keep each open item from the notes you were given at the start of this session until it is done.

## Facts to keep
What you learned that the chat alone will not tell you: names, preferences, and decisions with their reasons.

## Next steps
What you would do next, in order.

Write only the notes, and use no tool.)`;

/** What a full session is asked now: the owner's script from Setup, or the office's. */
export const checkpointAsk = async (): Promise<string> => (await handoffScript()) ?? CHECKPOINT_ASK;

/** How the notes open the fresh session's first message. */
const LEFT_OFF_HEAD =
  '(Where you left off: notes you wrote for yourself when your last chat session filled up. They are yours, not words from {owner}.)';

/**
 * When the Odd's chat session is at least `HANDOFF_TOKENS` full, as its last
 * run measured it, the session writes its notes, the office keeps them, and
 * the session ends, so the reply after this starts a fresh one. A run that
 * fails or says nothing keeps the session, and the next message tries again.
 * `runId` is the chat reply's own reservation, so the owner's Stop ends this too.
 */
export async function handOver(who: StaffRow, runId: string, timeoutMs: number): Promise<void> {
  const file = chatSession(who.id);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    // No session: the next reply starts a fresh one anyway.
    return;
  }
  const saved = parseSession(text);
  if (!saved || (saved.home ?? '') !== (await runHomeOf(who))) return;
  if ((saved.context ?? 0) < HANDOFF_TOKENS) return;
  const r = await run(who, await checkpointAsk(), {
    kind: 'chat',
    runId,
    sessionFile: file,
    timeoutMs,
    handoff: true
  });
  const notes = r.ok ? r.text.trim() : '';
  if (!notes) {
    if (!r.interrupted)
      console.error(`${who.name}'s chat session is full, but its notes failed: ${r.text}`);
    return;
  }
  replace(
    checkpointOf(who.id),
    notes.length <= CHECKPOINT_MAX ? notes : `${notes.slice(0, CHECKPOINT_MAX).trimEnd()}\n\n(cut)`
  );
  rmSync(file, { force: true });
}

/** The notes a fresh session starts with, when an earlier session left some. */
export function leftOff(id: string): string | undefined {
  try {
    const notes = readFileSync(checkpointOf(id), 'utf8').trim();
    return notes ? `${LEFT_OFF_HEAD}\n\n${notes}` : undefined;
  } catch {
    return undefined;
  }
}
