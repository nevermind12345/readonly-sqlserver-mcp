---
name: mediconnect-readonly-sqlserver
description: Use this skill when Codex needs to inspect Mediconnect SQL Server database structure or read-only data through the readonly-sqlserver MCP or CLI, especially for DICOM DB update scripts, stored procedure lookup, table or view description, SQL feature compatibility checks, or verifying inserted record keys without changing database state.
---

# Mediconnect Read-Only SQL Server

## Purpose

Use the `readonly-sqlserver-mcp` tooling only for read-only inspection of approved Mediconnect dev/test SQL Server databases. Treat the database login permissions as the primary safety boundary and the MCP/CLI query checks as secondary guardrails.

Never use this tooling for writes, admin tasks, migrations, cleanup, service operations, permission changes, index maintenance, schema changes, or production access unless the user has separately approved the account, database, and environment policy. Do not try to bypass blocked SQL by switching tools.

## Preferred Workflow

1. Start from source context in `D:\fh-repo\Mediconnect_Main_Dev`: scripts, resource files, DBML, processor code, and surrounding call sites.
2. Use structured SQL inspection before guessing database behavior:
   - `get_database_info` for database metadata and compatibility level.
   - `list_schemas`, `list_tables`, `describe_table`, and `describe_view` for shape.
   - `get_routine_definition` for known stored procedures/functions.
   - `search_sql_modules` when only a procedure/table/column fragment is known.
3. Use `run_select_query` only when metadata tools are insufficient. Keep ad-hoc queries narrow:
   - Always use `TOP` or an equivalent bounded result.
   - Select specific columns instead of `SELECT *`.
   - Filter by exact known identifiers when possible.
   - Prefer `ORDER BY` when checking "latest" or key-generation behavior.
4. Keep findings source-grounded. Cite the exact inspected database object, such as `dbo.usp_GenerateMWLAccessionNumber`, `dbo.DicomPath`, or `RES.vDICOM_PATH`, and distinguish database evidence from source-code inference.

## Data Safety

Avoid patient-sensitive data unless the user explicitly says it is needed for the task. Prefer schema, module text, row counts, IDs, timestamps, status columns, and non-PHI technical fields. If a query must touch patient-linked rows, request the smallest safe column set and redact or summarize values in the final answer.

Do not query broad clinical payloads, names, identifiers, accession details, report text, HL7 messages, DICOM tags containing patient data, credentials, tokens, encryption material, or audit-sensitive values unless the user explicitly authorizes that specific inspection.

## Mediconnect Use Cases

Use this skill for:

- DICOM database update script troubleshooting, especially comparing script assumptions with existing procedures/tables.
- Stored procedure lookup and module-text inspection before changing VB.NET or SQL resources.
- Table/view description before reasoning about DBML mappings, DTO fields, or query behavior.
- SQL Server feature issues, such as checking database compatibility level before rewriting SQL that uses newer functions like `TRY_CONVERT`.
- Verifying inserted record keys when source code calls `InsertOnSubmit` and `SubmitChanges`, by inspecting the relevant table/view and querying only the expected key/status columns.

Escalate back to the user before any task would require write access, admin privileges, schema changes, migrations, DBML regeneration, or broad patient-data inspection.

## Query Examples

Prefer structured MCP tools:

```text
describe_table(database, "dbo", "TABLE_NAME")
describe_view(database, "RES", "vDICOM_PATH")
get_routine_definition(database, "dbo", "usp_GenerateMWLAccessionNumber")
search_sql_modules(database, "TRY_CONVERT")
```

When a bounded SELECT is justified:

```sql
SELECT TOP 20 DicomPathID, CreatedDate, Status
FROM dbo.DicomPath
WHERE DicomPathID = @KnownId
ORDER BY DicomPathID DESC
```

Do not use write/admin SQL such as `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `EXEC`, `ALTER`, `CREATE`, `DROP`, `TRUNCATE`, `GRANT`, `DENY`, `DBCC`, `BACKUP`, `RESTORE`, or service/configuration commands.

## Reporting

In the final answer:

- State which source files and database objects were inspected.
- Cite object names directly, not just "the database".
- Explain uncertainty when the inspected object does not prove runtime behavior.
- State that the inspection was read-only.
- Keep any patient-sensitive values out of the answer unless the user explicitly requested them.
