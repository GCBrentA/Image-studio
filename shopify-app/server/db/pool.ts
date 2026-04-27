import pg from "pg";
import type { QueryResultRow } from "pg";
import { config } from "../config";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
});

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const result = await pool.query<T>(text, values);
  return result;
}
