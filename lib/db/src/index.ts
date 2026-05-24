import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Force UTF-8 client encoding on every new connection so Arabic /
// multi-byte text is never silently double-encoded when the PostgreSQL
// server's default client_encoding is not UTF-8.
pool.on("connect", (client) => {
  client.query("SET client_encoding = 'UTF8'").catch(() => {
    /* non-fatal — log nothing, keep the connection alive */
  });
});
export const db = drizzle(pool, { schema });

export * from "./schema";
