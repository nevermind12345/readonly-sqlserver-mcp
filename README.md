# readonly-sqlserver-mcp

Read-only SQL Server inspection CLI and core library for approved dev/test databases.

The current milestone is a CLI that exercises the same core code a future MCP server wrapper will expose to Codex. The project is intentionally conservative: SQL Server permissions are the primary safety boundary, and application-side checks are an extra guardrail.

## Status

- CLI/core scaffold is implemented.
- MCP stdio wrapper is implemented.
- Local validation currently passes with Node.js/npm available.
- Runtime dependency audit is clean with `npm audit --omit=dev`.
- Full audit currently reports dev-only Vitest/Vite/esbuild findings; do not force-upgrade unless you want a separate dependency update pass.

## Safety Model

Use a dedicated SQL login with read-only permissions. This is mandatory. Query validation reduces mistakes, but it must not be treated as a substitute for database permissions.

This tool is intended for known dev/test databases. Do not point it at production unless the account, network path, and access policy have been explicitly approved.

Safety defaults:

- Target databases must be present in `SQLSERVER_ALLOWED_DATABASES`.
- Ad-hoc query execution accepts only one `SELECT` or bounded CTE query.
- Write/admin keywords are rejected.
- Comments and semicolon-chained statements are rejected.
- `TOP`, `FETCH`, and `maxRows` are bounded.
- `OFFSET` must include `FETCH`.
- `TOP PERCENT`, non-literal row limits, linked-server style access, and file-style access are rejected.
- Query timeout is enforced.
- Secrets are read from environment variables only.
- Query results and secrets are not logged to files.

## Requirements

- Node.js 20 or newer
- npm
- SQL Server access only when you intentionally run CLI commands against a dev/test server

On this machine, npm may be available at:

```powershell
C:\Program Files\nodejs\npm.cmd
```

## Setup

```powershell
cd D:\MCP\readonly-sqlserver-mcp
npm install
```

If `npm` is not on `PATH`, use the full path:

```powershell
cd D:\MCP\readonly-sqlserver-mcp
cmd /c call "C:\Program Files\nodejs\npm.cmd" install
```

Create a local environment file only when you are ready to connect to a dev/test SQL Server:

```powershell
copy .env.example .env
```

Edit `.env` with a dedicated read-only SQL login. Do not commit `.env`.

## Environment Variables

```text
SQLSERVER_SERVER=localhost
SQLSERVER_PORT=1433
SQLSERVER_USER=readonly_login
SQLSERVER_PASSWORD=change-me
SQLSERVER_ALLOWED_DATABASES=APP_DEV_DB
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
SQLSERVER_DEFAULT_MAX_ROWS=200
SQLSERVER_QUERY_TIMEOUT_MS=10000
```

Keep `SQLSERVER_ALLOWED_DATABASES` narrow. Start with one dev/test database.

## Local Validation

These commands do not connect to SQL Server:

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

With the full npm path:

```powershell
cmd /c call "C:\Program Files\nodejs\npm.cmd" run typecheck
cmd /c call "C:\Program Files\nodejs\npm.cmd" test
cmd /c call "C:\Program Files\nodejs\npm.cmd" run build
cmd /c call "C:\Program Files\nodejs\npm.cmd" audit --omit=dev
```

## First Live Use

Only run these after `.env` is configured with a read-only login and a dev/test database allowlist.

Start with metadata commands:

```powershell
npm run cli -- list-databases
npm run cli -- db-info APP_DEV_DB
npm run cli -- list-schemas APP_DEV_DB
npm run cli -- list-tables APP_DEV_DB dbo
```

Then inspect objects:

```powershell
npm run cli -- describe-table APP_DEV_DB dbo ExampleTable
npm run cli -- describe-view APP_DEV_DB dbo ExampleView
npm run cli -- get-routine APP_DEV_DB dbo ExampleProcedure
npm run cli -- search-modules APP_DEV_DB ExampleSearchText
```

Use ad-hoc query only when the structured tools are not enough:

```powershell
npm run cli -- query APP_DEV_DB "SELECT TOP 20 name FROM sys.tables ORDER BY name"
```

## CLI Commands

```text
readonly-sqlserver list-databases
readonly-sqlserver db-info <database>
readonly-sqlserver list-schemas <database>
readonly-sqlserver list-tables <database> [schema]
readonly-sqlserver describe-table <database> <schema> <table>
readonly-sqlserver describe-view <database> <schema> <view>
readonly-sqlserver get-routine <database> <schema> <routine>
readonly-sqlserver search-modules <database> <searchText>
readonly-sqlserver query <database> <selectQuery> [maxRows]
```

During development, use:

```powershell
npm run cli -- <command>
```

After building, the package bin name is:

```text
readonly-sqlserver
```

## MCP Server

The MCP server is a stdio wrapper around the same shared core used by the CLI. It does not duplicate SQL safety logic.

Build before registering with Codex:

```powershell
npm run build
```

Run locally over stdio only when `.env` is configured:

```powershell
npm run mcp
```

The MCP server exposes these tools:

```text
list_databases
get_database_info
list_schemas
list_tables
describe_table
describe_view
get_routine_definition
search_sql_modules
run_select_query
```

To register with Codex, add this to `C:\Users\<you>\.codex\config.toml`:

```toml
[mcp_servers.readonly_sqlserver]
command = 'C:\Program Files\nodejs\node.exe'
args = ['D:\MCP\readonly-sqlserver-mcp\dist\mcpServer.js']
startup_timeout_sec = 30
```

Then restart Codex. Keep `D:\MCP\readonly-sqlserver-mcp\.env` local and uncommitted; the MCP server loads it from the project root.

## Project Layout

```text
src/cli.ts                 CLI entrypoint and argument handling
src/mcpServer.ts           MCP stdio server entrypoint
src/config.ts              Environment parsing and database allowlist checks
src/sqlClient.ts           SQL Server connection helpers
src/safety.ts              Ad-hoc query safety validation
src/tools/schemaTools.ts   Database/schema/table/view inspection tools
src/tools/routineTools.ts  Routine and SQL module inspection tools
src/tools/queryTools.ts    Bounded ad-hoc SELECT execution
src/index.ts               Public core exports
test/safety.test.ts        Query safety tests
```

## Git Notes

Commit source and lockfile files:

```text
.gitignore
.env.example
README.md
package.json
package-lock.json
tsconfig.json
src/
test/
```

Do not commit:

```text
node_modules/
dist/
.env
*.log
```

## MCP Wrapper Notes

The MCP wrapper calls the core functions exported from `src/index.ts`. Prefer structured tools first:

- `listDatabases`
- `getDatabaseInfo`
- `listSchemas`
- `listTables`
- `describeObject`
- `getRoutineDefinition`
- `searchSqlModules`

Use raw `runSelectQuery` sparingly, because ad-hoc SQL is the highest-risk surface even with validation.
