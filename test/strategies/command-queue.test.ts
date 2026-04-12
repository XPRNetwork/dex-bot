import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  readPending,
  appendResult,
  truncate,
  BotCommand,
  BotCommandResult,
} from '../../src/strategies/command-queue';

describe('command-queue', () => {
  let tmpDir: string;
  let cmdPath: string;
  let resultsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdq-'));
    cmdPath = path.join(tmpDir, 'commands.jsonl');
    resultsPath = path.join(tmpDir, 'results.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when file does not exist', async () => {
    const result = await readPending(cmdPath);
    expect(result).toEqual([]);
  });

  it('parses valid commands', async () => {
    const cmd: BotCommand = {
      id: 'a', type: 'clear_held', marketSymbol: 'XPR_XUSDC',
      issuedAt: '2026-04-12T00:00:00.000Z',
    };
    fs.writeFileSync(cmdPath, JSON.stringify(cmd) + '\n');
    const result = await readPending(cmdPath);
    expect(result).toEqual([cmd]);
  });

  it('dedupes commands by id (keeps first)', async () => {
    const a1: BotCommand = { id: 'a', type: 'clear_held', issuedAt: 't1' };
    const a2: BotCommand = { id: 'a', type: 'clear_non_held', issuedAt: 't2' };
    fs.writeFileSync(cmdPath, JSON.stringify(a1) + '\n' + JSON.stringify(a2) + '\n');
    const result = await readPending(cmdPath);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('clear_held');
  });

  it('skips malformed lines but parses valid ones after', async () => {
    const good: BotCommand = { id: 'good', type: 'clear_held', issuedAt: 't' };
    fs.writeFileSync(cmdPath, 'not-json\n' + JSON.stringify(good) + '\n');
    const result = await readPending(cmdPath);
    expect(result).toEqual([good]);
  });

  it('skips entries missing required fields', async () => {
    const lines = [
      JSON.stringify({ id: 'a', type: 'clear_held', issuedAt: 't' }), // valid
      JSON.stringify({ type: 'clear_held', issuedAt: 't' }),           // no id
      JSON.stringify({ id: 'b', issuedAt: 't' }),                       // no type
      JSON.stringify({ id: 'c', type: 'invalid', issuedAt: 't' }),      // bad type
    ];
    fs.writeFileSync(cmdPath, lines.join('\n') + '\n');
    const result = await readPending(cmdPath);
    expect(result.map(r => r.id)).toEqual(['a']);
  });

  it('appends a result preserving existing lines', async () => {
    const r1: BotCommandResult = { id: 'a', status: 'ok', appliedAt: 't1' };
    const r2: BotCommandResult = { id: 'b', status: 'error', appliedAt: 't2', message: 'x' };
    await appendResult(resultsPath, r1);
    await appendResult(resultsPath, r2);
    const lines = fs.readFileSync(resultsPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(r1);
    expect(JSON.parse(lines[1])).toEqual(r2);
  });

  it('rotates results file to last 200 entries', async () => {
    for (let i = 0; i < 210; i++) {
      await appendResult(resultsPath, {
        id: `r${i}`, status: 'ok', appliedAt: new Date().toISOString(),
      });
    }
    const lines = fs.readFileSync(resultsPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(200);
    expect(JSON.parse(lines[0]).id).toBe('r10');
    expect(JSON.parse(lines[199]).id).toBe('r209');
  });

  it('truncate empties the file', async () => {
    fs.writeFileSync(cmdPath, 'data\n');
    await truncate(cmdPath);
    expect(fs.readFileSync(cmdPath, 'utf-8')).toBe('');
  });

  it('truncate on missing file is a no-op', async () => {
    await expect(truncate(cmdPath)).resolves.toBeUndefined();
  });
});
