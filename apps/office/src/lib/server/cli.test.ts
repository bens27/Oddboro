// What a line of a tool's own stream tells the floor about the tool in use.
// Run with `npm test -w @oddboro/office`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contextOf, streamTools } from './claude.ts';
import { codexContext, codexReader } from './codex.ts';
import { toolWords } from '../staff/work.ts';

/** A tool call starting, as Claude Code and Grok stream it. */
const started = (name: string) => ({
  type: 'stream_event',
  event: { type: 'content_block_start', content_block: { type: 'tool_use', name } }
});

test('a Codex file change and a Grok edit reach the floor and the chat as a Claude Code Edit, in the same words', () => {
  const claude = streamTools('claude', started('Edit'));
  const grok = streamTools('grok', started('search_replace'));
  const codex = codexReader('codex')({
    type: 'item.completed',
    item: { id: 'i1', type: 'file_change', changes: [], status: 'completed' }
  }).flatMap((e) => (e.type === 'tool' ? [e.name] : []));
  assert.deepEqual([claude, grok, codex], [['Edit'], ['Edit'], ['Edit']]);
  assert.equal(toolWords(grok[0]), 'Editing files');
});

test("a Codex shell command reaches the floor as Claude Code's Bash, and Grok looking for a tool as ToolSearch", () => {
  const codex = codexReader('codex')({
    type: 'item.started',
    item: { id: 'i2', type: 'command_execution', command: 'ls', status: 'in_progress' }
  });
  assert.deepEqual(codex, [{ type: 'tool', name: 'Bash' }]);
  assert.deepEqual(streamTools('grok', started('search_tool')), ['ToolSearch']);
});

test("a Claude Code or Grok line's context is all its call read and wrote, and a subagent's says nothing", () => {
  const usage = {
    input_tokens: 263,
    output_tokens: 28,
    cache_read_input_tokens: 8576,
    cache_creation_input_tokens: 100
  };
  assert.equal(
    contextOf({ type: 'assistant', parent_tool_use_id: null, message: { usage } }),
    8967
  );
  assert.equal(
    contextOf({ type: 'assistant', parent_tool_use_id: 'toolu_1', message: { usage } }),
    undefined
  );
  assert.equal(contextOf({ type: 'assistant', message: { content: [] } }), undefined);
  assert.equal(contextOf({ type: 'result', usage }), undefined);
});

test("a Codex thread's context is the last token count in its session file, newest file first", () => {
  const home = mkdtempSync(join(tmpdir(), 'oddboro-codex-context-'));
  try {
    const thread = '019e69b9-d71e-7f61-aee5-c2eb3ea2d2a6';
    const count = (total: number) =>
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            last_token_usage: { input_tokens: total - 7, output_tokens: 7, total_tokens: total }
          }
        }
      });
    const day = (d: string) => {
      const dir = join(home, 'sessions', '2026', '11', d);
      mkdirSync(dir, { recursive: true });
      return dir;
    };
    assert.equal(codexContext(home, thread), undefined);
    writeFileSync(join(day('03'), `rollout-2026-11-03T10-00-00-${thread}.jsonl`), count(50_000));
    writeFileSync(
      join(day('15'), `rollout-2026-11-15T09-00-00-${thread}.jsonl`),
      [
        count(90_000),
        count(130_500),
        '{"type":"event_msg","payload":{"type":"agent_message"}}'
      ].join('\n')
    );
    writeFileSync(join(day('16'), 'rollout-2026-11-16T09-00-00-another.jsonl'), count(1));
    assert.equal(codexContext(home, thread), 130_500);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
