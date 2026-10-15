import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  // Vercel's Neon Marketplace integration exposes POSTGRES_URL by default.
  // DATABASE_URL remains the preferred name for self-hosted deployments.
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}
