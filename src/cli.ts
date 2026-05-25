import dotenv from "dotenv";
import { loadConfig } from "./config.js";
import { getDatabaseInfo, listDatabases, listSchemas, listTables, describeObject } from "./tools/schemaTools.js";
import { getRoutineDefinition, searchSqlModules } from "./tools/routineTools.js";
import { runSelectQuery } from "./tools/queryTools.js";

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(): never {
  console.error(`Usage:
  readonly-sqlserver list-databases
  readonly-sqlserver db-info <database>
  readonly-sqlserver list-schemas <database>
  readonly-sqlserver list-tables <database> [schema]
  readonly-sqlserver describe-table <database> <schema> <table>
  readonly-sqlserver describe-view <database> <schema> <view>
  readonly-sqlserver get-routine <database> <schema> <routine>
  readonly-sqlserver search-modules <database> <searchText>
  readonly-sqlserver query <database> <selectQuery> [maxRows]
`);
  process.exit(2);
}

function parseMaxRows(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const maxRows = Number(value);
  if (!Number.isSafeInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer.");
  }

  return maxRows;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  dotenv.config();
  const config = loadConfig();

  switch (command) {
    case "list-databases":
      printJson(await listDatabases(config));
      return;
    case "db-info":
      if (args.length !== 1) usage();
      printJson(await getDatabaseInfo(config, args[0]));
      return;
    case "list-schemas":
      if (args.length !== 1) usage();
      printJson(await listSchemas(config, args[0]));
      return;
    case "list-tables":
      if (args.length < 1 || args.length > 2) usage();
      printJson(await listTables(config, args[0], args[1]));
      return;
    case "describe-table":
      if (args.length !== 3) usage();
      printJson(await describeObject(config, args[0], args[1], args[2], "table"));
      return;
    case "describe-view":
      if (args.length !== 3) usage();
      printJson(await describeObject(config, args[0], args[1], args[2], "view"));
      return;
    case "get-routine":
      if (args.length !== 3) usage();
      printJson(await getRoutineDefinition(config, args[0], args[1], args[2]));
      return;
    case "search-modules":
      if (args.length !== 2) usage();
      printJson(await searchSqlModules(config, args[0], args[1]));
      return;
    case "query":
      if (args.length < 2 || args.length > 3) usage();
      printJson(await runSelectQuery(config, args[0], args[1], parseMaxRows(args[2])));
      return;
    default:
      usage();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
