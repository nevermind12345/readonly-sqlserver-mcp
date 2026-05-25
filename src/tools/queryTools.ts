import { AppConfig } from "../config.js";
import { withDatabasePool } from "../sqlClient.js";
import { validateReadOnlyQuery } from "../safety.js";

export async function runSelectQuery(config: AppConfig, database: string, query: string, maxRows = config.defaultMaxRows) {
  const safe = validateReadOnlyQuery(query, { maxRows: Math.min(maxRows, config.defaultMaxRows) });

  return withDatabasePool(config, database, async (pool) => {
    const result = await pool.request().query(safe.sql);
    return {
      rowCount: result.recordset.length,
      maxRows: safe.maxRows,
      rows: result.recordset.slice(0, safe.maxRows)
    };
  });
}
