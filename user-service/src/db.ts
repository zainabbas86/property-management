import { Pool } from 'pg'

export const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         BIGSERIAL    PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      email      VARCHAR(255) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `)
  // After a bulk migration, the BIGSERIAL sequence may be behind the highest
  // explicitly-inserted id. Sync it so new users get non-conflicting ids.
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('users', 'id'),
      COALESCE((SELECT MAX(id) FROM users), 0) + 1,
      false
    )
  `)
}
