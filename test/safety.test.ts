import { describe, expect, it } from "vitest";
import { validateReadOnlyQuery } from "../src/safety.js";

describe("validateReadOnlyQuery", () => {
  it("injects TOP for simple SELECT queries", () => {
    const result = validateReadOnlyQuery("SELECT Id FROM dbo.TableA ORDER BY Id DESC", { maxRows: 50 });
    expect(result.sql).toBe("SELECT TOP (50) Id FROM dbo.TableA ORDER BY Id DESC");
  });

  it("keeps bounded SELECT queries", () => {
    const result = validateReadOnlyQuery("SELECT TOP (10) Id FROM dbo.TableA", { maxRows: 50 });
    expect(result.sql).toBe("SELECT TOP (10) Id FROM dbo.TableA");
  });

  it("keeps bounded SELECT queries with TOP without parentheses", () => {
    const result = validateReadOnlyQuery("SELECT TOP 10 Id FROM dbo.TableA", { maxRows: 50 });
    expect(result.sql).toBe("SELECT TOP 10 Id FROM dbo.TableA");
  });

  it("rejects SELECT queries with row limits over maxRows", () => {
    expect(() => validateReadOnlyQuery("SELECT TOP (51) Id FROM dbo.TableA", { maxRows: 50 })).toThrow(/TOP/);
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA ORDER BY Id OFFSET 0 ROWS FETCH NEXT 51 ROWS ONLY", { maxRows: 50 })).toThrow(/FETCH/);
  });

  it("rejects unbounded OFFSET and TOP PERCENT", () => {
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA ORDER BY Id OFFSET 0 ROWS", { maxRows: 50 })).toThrow(/OFFSET/);
    expect(() => validateReadOnlyQuery("SELECT TOP (100) PERCENT Id FROM dbo.TableA", { maxRows: 50 })).toThrow(/TOP PERCENT/);
  });

  it("rejects non-literal row limits", () => {
    expect(() => validateReadOnlyQuery("SELECT TOP (@maxRows) Id FROM dbo.TableA", { maxRows: 50 })).toThrow(/TOP/);
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA ORDER BY Id OFFSET 0 ROWS FETCH NEXT @maxRows ROWS ONLY", { maxRows: 50 })).toThrow(/FETCH/);
  });

  it("rejects writes", () => {
    expect(() => validateReadOnlyQuery("UPDATE dbo.TableA SET Name = 'x'", { maxRows: 50 })).toThrow(/SELECT-style/);
  });

  it("rejects file and linked-server style access", () => {
    expect(() => validateReadOnlyQuery("SELECT * FROM OPENROWSET('SQLNCLI', 'server=x', 'SELECT 1')", { maxRows: 50 })).toThrow(/OPENROWSET/);
  });

  it("rejects comments", () => {
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA -- comment", { maxRows: 50 })).toThrow(/Comments/);
  });

  it("rejects semicolon-chained statements", () => {
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA; SELECT Id FROM dbo.TableB", { maxRows: 50 })).toThrow(/one statement/);
  });

  it("rejects unbounded CTE queries", () => {
    expect(() => validateReadOnlyQuery("WITH x AS (SELECT TOP (1) Id FROM dbo.TableA) SELECT * FROM x", { maxRows: 50 })).toThrow(/CTE/);
  });

  it("keeps bounded CTE queries", () => {
    const result = validateReadOnlyQuery("WITH x AS (SELECT Id FROM dbo.TableA) SELECT TOP (20) * FROM x", { maxRows: 50 });
    expect(result.sql).toBe("WITH x AS (SELECT Id FROM dbo.TableA) SELECT TOP (20) * FROM x");
  });

  it("rejects invalid maxRows", () => {
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA", { maxRows: Number.NaN })).toThrow(/maxRows/);
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA", { maxRows: 0 })).toThrow(/maxRows/);
    expect(() => validateReadOnlyQuery("SELECT Id FROM dbo.TableA", { maxRows: 1001 })).toThrow(/maxRows/);
  });
});
