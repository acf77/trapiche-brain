import { createClient, type InArgs } from "@libsql/client";
import { config } from "../config.js";
import { ProviderError } from "../lib/http.js";

function getClient() {
  if (!config.turso.url || !config.turso.authToken) {
    throw new ProviderError("DB_URL and DB_AUTH_TOKEN not configured", 400);
  }
  return createClient({
    url: config.turso.url,
    authToken: config.turso.authToken,
  });
}

function stripQuoted(sql: string): string {
  return sql.replace(/'([^']|'')*'/g, "''").replace(/"([^"]|"")*"/g, "\"\"");
}

export function assertReadOnlySql(sql: string) {
  const normalized = stripQuoted(sql).trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) throw new ProviderError("SQL is required", 400);
  if (normalized.includes(";")) throw new ProviderError("Only a single SQL statement is allowed", 400);
  if (!/^(select|with)\b/.test(normalized)) {
    throw new ProviderError("Only SELECT/WITH read queries are allowed", 400);
  }
  if (/--|\/\*/.test(normalized)) {
    throw new ProviderError("SQL comments are not allowed", 400);
  }
  if (
    /\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum|reindex)\b/.test(
      normalized,
    )
  ) {
    throw new ProviderError("Mutating SQL is not allowed", 400);
  }
}

export async function listTables() {
  const client = getClient();
  const result = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  client.close();
  return result.rows.map((row) => String(row.name));
}

export async function runReadOnlyQuery(sql: string, args: InArgs = []) {
  assertReadOnlySql(sql);
  const client = getClient();
  const result = await client.execute({ sql, args });
  client.close();

  return {
    columns: result.columns,
    rows: result.rows,
    rowsAffected: result.rowsAffected,
  };
}
