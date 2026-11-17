// The owner's session handoff script, kept from Setup. Run with `npm test -w @oddboro/ledger`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './pglite.ts';

const { handoffScript, setHandoffScript, HANDOFF_SCRIPT_MAX, ownerName, setOwnerName } =
  await import('../src/office.ts');

test("the owner's script is kept before the welcome names them, and null goes back to the office's", async () => {
  assert.equal(await handoffScript(), null);
  await setHandoffScript('  Write what {owner} wants next.  ');
  assert.equal(await handoffScript(), 'Write what {owner} wants next.');
  assert.equal(await ownerName(), 'the owner');
  await setOwnerName('Tester');
  assert.equal(await handoffScript(), 'Write what {owner} wants next.', 'naming the owner lost it');
  await setHandoffScript(null);
  assert.equal(await handoffScript(), null);
  await setHandoffScript('   ');
  assert.equal(await handoffScript(), null, 'an empty script is the office’s');
});

test('a script over the limit is refused and the one before stays', async () => {
  await setHandoffScript('Keep this.');
  await assert.rejects(setHandoffScript('x'.repeat(HANDOFF_SCRIPT_MAX + 1)), /under 8,000/);
  assert.equal(await handoffScript(), 'Keep this.');
  await setHandoffScript(null);
});
