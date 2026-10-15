import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL or POSTGRES_URL before running migrations.");
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const migrationsDir = resolve("infra/migrations");
    const migrations = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
    for (const name of migrations) {
      const migration = await readFile(resolve(migrationsDir, name), "utf8");
      await pool.query(migration);
      console.log(`Applied ${name}`);
    }
  } finally {
    await pool.end();
  }
}

void main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Migration failed.");
  process.exitCode = 1;
});
