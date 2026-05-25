import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  SQLSERVER_SERVER: z.string().min(1),
  SQLSERVER_PORT: z.coerce.number().int().positive().default(1433),
  SQLSERVER_USER: z.string().min(1),
  SQLSERVER_PASSWORD: z.string().min(1),
  SQLSERVER_ALLOWED_DATABASES: z.string().min(1),
  SQLSERVER_ENCRYPT: booleanFromEnv.default(false),
  SQLSERVER_TRUST_SERVER_CERTIFICATE: booleanFromEnv.default(true),
  SQLSERVER_DEFAULT_MAX_ROWS: z.coerce.number().int().positive().max(1000).default(200),
  SQLSERVER_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(10000)
});

export interface AppConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  allowedDatabases: string[];
  encrypt: boolean;
  trustServerCertificate: boolean;
  defaultMaxRows: number;
  queryTimeoutMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const allowedDatabases = parsed.SQLSERVER_ALLOWED_DATABASES
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedDatabases.length === 0) {
    throw new Error("SQLSERVER_ALLOWED_DATABASES must contain at least one database name.");
  }

  return {
    server: parsed.SQLSERVER_SERVER,
    port: parsed.SQLSERVER_PORT,
    user: parsed.SQLSERVER_USER,
    password: parsed.SQLSERVER_PASSWORD,
    allowedDatabases,
    encrypt: parsed.SQLSERVER_ENCRYPT,
    trustServerCertificate: parsed.SQLSERVER_TRUST_SERVER_CERTIFICATE,
    defaultMaxRows: parsed.SQLSERVER_DEFAULT_MAX_ROWS,
    queryTimeoutMs: parsed.SQLSERVER_QUERY_TIMEOUT_MS
  };
}

export function assertAllowedDatabase(config: AppConfig, database: string) {
  const allowed = config.allowedDatabases.some((allowedName) => allowedName.toLowerCase() === database.toLowerCase());
  if (!allowed) {
    throw new Error(`Database '${database}' is not in SQLSERVER_ALLOWED_DATABASES.`);
  }
}
