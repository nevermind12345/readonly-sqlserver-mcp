import sql from "mssql";
import { AppConfig, assertAllowedDatabase } from "./config.js";

export type SqlPool = sql.ConnectionPool;

export async function withDatabasePool<T>(config: AppConfig, database: string, action: (pool: SqlPool) => Promise<T>) {
  assertAllowedDatabase(config, database);
  const pool = new sql.ConnectionPool({
    server: config.server,
    port: config.port,
    user: config.user,
    password: config.password,
    database,
    options: {
      encrypt: config.encrypt,
      trustServerCertificate: config.trustServerCertificate
    },
    requestTimeout: config.queryTimeoutMs,
    connectionTimeout: config.queryTimeoutMs
  });

  await pool.connect();
  try {
    return await action(pool);
  } finally {
    await pool.close();
  }
}

export async function withMasterPool<T>(config: AppConfig, action: (pool: SqlPool) => Promise<T>) {
  const pool = new sql.ConnectionPool({
    server: config.server,
    port: config.port,
    user: config.user,
    password: config.password,
    database: "master",
    options: {
      encrypt: config.encrypt,
      trustServerCertificate: config.trustServerCertificate
    },
    requestTimeout: config.queryTimeoutMs,
    connectionTimeout: config.queryTimeoutMs
  });

  await pool.connect();
  try {
    return await action(pool);
  } finally {
    await pool.close();
  }
}
