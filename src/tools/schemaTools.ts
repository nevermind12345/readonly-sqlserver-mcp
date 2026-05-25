import sql from "mssql";
import { AppConfig, assertAllowedDatabase } from "../config.js";
import { withDatabasePool, withMasterPool } from "../sqlClient.js";

export async function listDatabases(config: AppConfig) {
  const allowed = config.allowedDatabases.map((name) => name.toLowerCase());
  return withMasterPool(config, async (pool) => {
    const request = pool.request();
    config.allowedDatabases.forEach((name, index) => request.input(`db${index}`, sql.NVarChar, name.toLowerCase()));
    const result = await request.query(`
      SELECT name, compatibility_level, state_desc, recovery_model_desc
      FROM sys.databases
      WHERE LOWER(name) IN (${allowed.map((_, index) => `@db${index}`).join(", ")})
      ORDER BY name;
    `);

    return result.recordset;
  });
}

export async function getDatabaseInfo(config: AppConfig, database: string) {
  assertAllowedDatabase(config, database);
  return withMasterPool(config, async (pool) => {
    const result = await pool.request()
      .input("database", sql.NVarChar, database)
      .query(`
        SELECT name, compatibility_level, collation_name, state_desc, recovery_model_desc, create_date
        FROM sys.databases
        WHERE name = @database;
      `);
    return result.recordset[0] ?? null;
  });
}

export async function listSchemas(config: AppConfig, database: string) {
  return withDatabasePool(config, database, async (pool) => {
    const result = await pool.request().query(`
      SELECT name
      FROM sys.schemas
      WHERE principal_id IS NOT NULL
      ORDER BY name;
    `);
    return result.recordset;
  });
}

export async function listTables(config: AppConfig, database: string, schema?: string) {
  return withDatabasePool(config, database, async (pool) => {
    const result = await pool.request()
      .input("schema", sql.NVarChar, schema ?? null)
      .query(`
        SELECT s.name AS schema_name, t.name AS table_name, t.create_date, t.modify_date
        FROM sys.tables t
        INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
        WHERE (@schema IS NULL OR s.name = @schema)
        ORDER BY s.name, t.name;
      `);
    return result.recordset;
  });
}

export async function describeObject(config: AppConfig, database: string, schema: string, objectName: string, objectType: "table" | "view") {
  return withDatabasePool(config, database, async (pool) => {
    const result = await pool.request()
      .input("schema", sql.NVarChar, schema)
      .input("objectName", sql.NVarChar, objectName)
      .input("objectType", sql.Char, objectType === "table" ? "U" : "V")
      .query(`
        SELECT
          c.column_id,
          c.name AS column_name,
          ty.name AS type_name,
          c.max_length,
          c.precision,
          c.scale,
          c.is_nullable,
          c.is_identity,
          dc.definition AS default_definition
        FROM sys.objects o
        INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
        INNER JOIN sys.columns c ON c.object_id = o.object_id
        INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
        WHERE s.name = @schema AND o.name = @objectName AND o.type = @objectType
        ORDER BY c.column_id;
      `);

    return result.recordset;
  });
}
