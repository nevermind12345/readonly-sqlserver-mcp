import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { getRoutineDefinition, searchSqlModules } from "./tools/routineTools.js";
import { describeObject, getDatabaseInfo, listDatabases, listSchemas, listTables } from "./tools/schemaTools.js";
import { runSelectQuery } from "./tools/queryTools.js";

function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value)
      }
    ]
  };
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(projectRoot, ".env") });

const config = loadConfig();

const server = new McpServer({
  name: "readonly-sqlserver-mcp",
  version: "0.1.0"
});

const databaseSchema = {
  database: z.string().min(1).describe("Allowed SQL Server database name.")
};

const schemaFilterSchema = {
  ...databaseSchema,
  schema: z.string().min(1).optional().describe("Optional schema name filter.")
};

const objectSchema = {
  ...databaseSchema,
  schema: z.string().min(1).describe("SQL schema name."),
  objectName: z.string().min(1).describe("Table or view name.")
};

const routineSchema = {
  ...databaseSchema,
  schema: z.string().min(1).describe("SQL schema name."),
  routine: z.string().min(1).describe("Routine, view, or trigger name.")
};

server.registerTool(
  "list_databases",
  {
    description: "List configured allowlisted SQL Server databases that are visible to the read-only login."
  },
  async () => jsonContent(await listDatabases(config))
);

server.registerTool(
  "get_database_info",
  {
    description: "Get metadata for one allowlisted SQL Server database.",
    inputSchema: databaseSchema
  },
  async ({ database }) => jsonContent(await getDatabaseInfo(config, database))
);

server.registerTool(
  "list_schemas",
  {
    description: "List schemas in one allowlisted SQL Server database.",
    inputSchema: databaseSchema
  },
  async ({ database }) => jsonContent(await listSchemas(config, database))
);

server.registerTool(
  "list_tables",
  {
    description: "List tables in one allowlisted SQL Server database, optionally filtered by schema.",
    inputSchema: schemaFilterSchema
  },
  async ({ database, schema }) => jsonContent(await listTables(config, database, schema))
);

server.registerTool(
  "describe_table",
  {
    description: "Describe columns for a table in one allowlisted SQL Server database.",
    inputSchema: objectSchema
  },
  async ({ database, schema, objectName }) => jsonContent(await describeObject(config, database, schema, objectName, "table"))
);

server.registerTool(
  "describe_view",
  {
    description: "Describe columns for a view in one allowlisted SQL Server database.",
    inputSchema: objectSchema
  },
  async ({ database, schema, objectName }) => jsonContent(await describeObject(config, database, schema, objectName, "view"))
);

server.registerTool(
  "get_routine_definition",
  {
    description: "Get the definition for a stored procedure, function, view, or trigger.",
    inputSchema: routineSchema
  },
  async ({ database, schema, routine }) => jsonContent(await getRoutineDefinition(config, database, schema, routine))
);

server.registerTool(
  "search_sql_modules",
  {
    description: "Search SQL module definitions in one allowlisted SQL Server database.",
    inputSchema: {
      ...databaseSchema,
      searchText: z.string().min(2).describe("Text to search for in SQL module definitions.")
    }
  },
  async ({ database, searchText }) => jsonContent(await searchSqlModules(config, database, searchText))
);

server.registerTool(
  "run_select_query",
  {
    description: "Run one bounded read-only SELECT-style query against an allowlisted SQL Server database.",
    inputSchema: {
      ...databaseSchema,
      query: z.string().min(1).describe("Single read-only SELECT or bounded CTE query."),
      maxRows: z.number().int().positive().max(1000).optional().describe("Optional row cap, also bounded by SQLSERVER_DEFAULT_MAX_ROWS.")
    }
  },
  async ({ database, query, maxRows }) => jsonContent(await runSelectQuery(config, database, query, maxRows))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
