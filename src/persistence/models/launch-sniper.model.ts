import { getDatabase, getCurrentTimestamp } from '../database.js';

export interface LaunchSniperPositionRow {
  curve_id: number;
  symbol: string;
  precision_val: number;
  creator: string;
  detected_at: number;
  buy_executed_at: number;
  entry_price_xpr_per_token: number;
  tokens_held: string;  // bigint as string
  original_tokens_bought: string;  // bigint as string — never changes after buy, used for sell %
  token_contract: string;
  sell_targets_hit: string;  // JSON array of booleans
  status: string;
  total_xpr_spent: number;
  momentum_exit_done: number;
  updated_at: string;
}

export class LaunchSniperRepository {
  upsertPosition(pos: Omit<LaunchSniperPositionRow, 'updated_at'>): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO launch_sniper_positions
        (curve_id, symbol, precision_val, creator, detected_at, buy_executed_at,
         entry_price_xpr_per_token, tokens_held, original_tokens_bought, token_contract,
         sell_targets_hit, status, total_xpr_spent, momentum_exit_done, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(curve_id) DO UPDATE SET
        symbol = excluded.symbol,
        precision_val = excluded.precision_val,
        creator = excluded.creator,
        detected_at = excluded.detected_at,
        buy_executed_at = excluded.buy_executed_at,
        entry_price_xpr_per_token = excluded.entry_price_xpr_per_token,
        tokens_held = excluded.tokens_held,
        original_tokens_bought = excluded.original_tokens_bought,
        token_contract = excluded.token_contract,
        sell_targets_hit = excluded.sell_targets_hit,
        status = excluded.status,
        total_xpr_spent = excluded.total_xpr_spent,
        momentum_exit_done = excluded.momentum_exit_done,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      pos.curve_id, pos.symbol, pos.precision_val, pos.creator,
      pos.detected_at, pos.buy_executed_at, pos.entry_price_xpr_per_token,
      pos.tokens_held, pos.original_tokens_bought, pos.token_contract,
      pos.sell_targets_hit, pos.status, pos.total_xpr_spent, pos.momentum_exit_done,
      getCurrentTimestamp()
    );
  }

  getPosition(curveId: number): LaunchSniperPositionRow | undefined {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM launch_sniper_positions WHERE curve_id = ?');
    return stmt.get(curveId) as LaunchSniperPositionRow | undefined;
  }

  getAllActivePositions(): LaunchSniperPositionRow[] {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT * FROM launch_sniper_positions
       WHERE status IN ('waiting', 'bought', 'partial_sold', 'graduated')
       ORDER BY detected_at DESC`
    );
    return stmt.all() as LaunchSniperPositionRow[];
  }

  getAllPositions(): LaunchSniperPositionRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM launch_sniper_positions ORDER BY detected_at DESC');
    return stmt.all() as LaunchSniperPositionRow[];
  }

  deletePosition(curveId: number): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM launch_sniper_positions WHERE curve_id = ?');
    stmt.run(curveId);
  }
}

export const launchSniperRepository = new LaunchSniperRepository();
