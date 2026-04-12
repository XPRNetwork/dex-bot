import * as fsp from 'fs/promises';

export interface BotCommand {
  id: string;
  type: 'cancel_order' | 'clear_held' | 'clear_non_held';
  marketSymbol?: string;
  orderId?: string;
  issuedAt: string;
}

export interface BotCommandResult {
  id: string;
  status: 'ok' | 'error' | 'skipped' | 'queued' | 'pending';
  message?: string;
  appliedAt: string;
}

const MAX_RESULTS = 200;

export async function readPending(filePath: string): Promise<BotCommand[]> {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    const seen = new Set<string>();
    const out: BotCommand[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as BotCommand;
        if (!parsed.id || seen.has(parsed.id)) continue;
        seen.add(parsed.id);
        out.push(parsed);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function appendResult(filePath: string, result: BotCommandResult): Promise<void> {
  let existing = '';
  try {
    existing = await fsp.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const lines = existing.split('\n').filter(Boolean);
  lines.push(JSON.stringify(result));
  const trimmed = lines.slice(-MAX_RESULTS);
  await fsp.writeFile(filePath, trimmed.join('\n') + '\n');
}

export async function truncate(filePath: string): Promise<void> {
  try {
    await fsp.writeFile(filePath, '');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
