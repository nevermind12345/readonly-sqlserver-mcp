import sql from "mssql";
import { AppConfig } from "../config.js";
import { withDatabasePool } from "../sqlClient.js";

export async function getRoutineDefinition(config: AppConfig, database: string, schema: string, routine: string) {
  return withDatabasePool(config, database, async (pool) => {
    const result = await pool.request()
      .input("schema", sql.NVarChar, schema)
      .input("routine", sql.NVarChar, routine)
      .query(`
        SELECT s.name AS schema_name, o.name AS routine_name, o.type_desc, m.definition
        FROM sys.objects o
        INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
        INNER JOIN sys.sql_modules m ON m.object_id = o.object_id
        WHERE s.name = @schema AND o.name = @routine
          AND o.type IN ('P', 'FN', 'IF', 'TF', 'V', 'TR');
      `);
    return result.recordset[0] ?? null;
  });
}

export async function searchSqlModules(config: AppConfig, database: string, searchText: string) {
  if (searchText.trim().length < 2) {
    throw new Error("Search text must contain at least 2 characters.");
  }

  return withDatabasePool(config, database, async (pool) => {
    const result = await pool.request()
      .input("search", sql.NVarChar, `%${searchText}%`)
      .query(`
        SELECT TOP (100)
          s.name AS schema_name,
          o.name AS object_name,
          o.type_desc,
          CHARINDEX(@search, m.definition) AS match_position
        FROM sys.sql_modules m
        INNER JOIN sys.objects o ON o.object_id = m.object_id
        INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
        WHERE m.definition LIKE @search
        ORDER BY s.name, o.name;
      `);
    return result.recordset;
  });
}
