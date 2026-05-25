export interface SafeQueryOptions {
  maxRows: number;
}

export interface SafeQuery {
  sql: string;
  maxRows: number;
}

const absoluteMaxRows = 1000;

const blockedKeywords = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "EXEC",
  "EXECUTE",
  "ALTER",
  "DROP",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "BACKUP",
  "RESTORE",
  "DBCC",
  "DENY",
  "INTO",
  "WAITFOR",
  "USE",
  "OPENROWSET",
  "OPENDATASOURCE",
  "OPENQUERY",
  "BULK"
];

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validateMaxRows(maxRows: number) {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > absoluteMaxRows) {
    throw new Error(`maxRows must be a positive integer no greater than ${absoluteMaxRows}.`);
  }
}

function validateExistingRowLimit(sql: string, maxRows: number) {
  if (/\bTOP\s*(?:\(\s*\d+\s*\)|\d+)\s+PERCENT\b/i.test(sql)) {
    throw new Error("TOP PERCENT is not allowed in ad-hoc queries.");
  }
  const topMatch = /\bTOP\s*(?:\(\s*(\d+)\s*\)|(\d+)\b)/i.exec(sql);
  if (/\bTOP\b/i.test(sql) && !topMatch) {
    throw new Error("TOP must use a positive integer literal in ad-hoc queries.");
  }

  const topValue = topMatch ? parsePositiveInteger(topMatch[1] ?? topMatch[2]) : null;
  if (topMatch && (topValue === null || topValue > maxRows)) {
    throw new Error(`TOP must be a positive integer no greater than ${maxRows}.`);
  }

  const fetchMatch = /\bFETCH\s+(?:NEXT|FIRST)\s+(\d+)\s+ROWS?\s+ONLY\b/i.exec(sql);
  if (/\bFETCH\b/i.test(sql) && !fetchMatch) {
    throw new Error("FETCH must use a positive integer literal and ROWS ONLY in ad-hoc queries.");
  }

  const fetchValue = fetchMatch ? parsePositiveInteger(fetchMatch[1]) : null;
  if (fetchMatch && (fetchValue === null || fetchValue > maxRows)) {
    throw new Error(`FETCH must be a positive integer no greater than ${maxRows}.`);
  }

  if (/\bOFFSET\b/i.test(sql) && !fetchMatch) {
    throw new Error("OFFSET must include FETCH so result size is bounded at SQL Server.");
  }

  return topMatch !== null || fetchMatch !== null;
}

function getRowLimitScopeSql(sql: string) {
  if (!/^WITH\b/i.test(sql)) {
    return sql;
  }

  const outerSelectMatch = /\)\s*(SELECT[\s\S]*)$/i.exec(sql);
  if (!outerSelectMatch) {
    throw new Error("CTE queries must end with a SELECT query.");
  }

  return outerSelectMatch[1];
}

export function validateIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_@$#]*$/.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
}

export function quoteName(value: string) {
  validateIdentifier(value, "Identifier");
  return `[${value.replace(/]/g, "]]")}]`;
}

export function validateReadOnlyQuery(input: string, options: SafeQueryOptions): SafeQuery {
  validateMaxRows(options.maxRows);

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new Error("Query cannot be empty.");
  }

  if (/--|\/\*|\*\//.test(trimmed)) {
    throw new Error("Comments are not allowed in ad-hoc queries.");
  }

  const semicolonMatches = trimmed.match(/;/g) ?? [];
  if (semicolonMatches.length > 1 || (semicolonMatches.length === 1 && !trimmed.endsWith(";"))) {
    throw new Error("Only one statement is allowed.");
  }

  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "").trim();
  const upper = withoutTrailingSemicolon.toUpperCase();

  if (!/^(SELECT|WITH)\b/.test(upper)) {
    throw new Error("Only SELECT-style read queries are allowed.");
  }

  for (const keyword of blockedKeywords) {
    const keywordPattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (keywordPattern.test(withoutTrailingSemicolon)) {
      throw new Error(`Keyword '${keyword}' is not allowed in ad-hoc queries.`);
    }
  }

  const rowLimitScopeSql = getRowLimitScopeSql(withoutTrailingSemicolon);
  const hasExistingRowLimit = validateExistingRowLimit(rowLimitScopeSql, options.maxRows);

  if (/^WITH\b/i.test(withoutTrailingSemicolon) && !hasExistingRowLimit) {
    throw new Error("CTE queries must include TOP or FETCH on the outer query so result size is bounded at SQL Server.");
  }

  let sql = withoutTrailingSemicolon;
  if (/^SELECT\s+DISTINCT\b/i.test(sql) && !hasExistingRowLimit) {
    sql = sql.replace(/^SELECT\s+DISTINCT\b/i, `SELECT DISTINCT TOP (${options.maxRows})`);
  } else if (/^SELECT\b/i.test(sql) && !hasExistingRowLimit) {
    sql = sql.replace(/^SELECT\b/i, `SELECT TOP (${options.maxRows})`);
  }

  return {
    sql,
    maxRows: options.maxRows
  };
}
