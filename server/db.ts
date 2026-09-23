import crypto from 'node:crypto';
import { createPool, db as drizzleDb } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';

export const pool = createPool();
export { drizzleDb, schema };

// Password hashing utilities using built-in crypto (scrypt)
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const key = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Transform SQLite SQL syntax (? placeholders, INSERT OR REPLACE) into standard PostgreSQL syntax ($1, $2, ON CONFLICT)
export function transformSql(sql: string): string {
  let idx = 1;
  let text = sql.replace(/\?/g, () => `$${idx++}`);

  // Replace SQLite INSERT OR REPLACE for password resets
  if (/INSERT\s+OR\s+REPLACE\s+INTO\s+password_resets/i.test(text)) {
    text = text.replace(
      /INSERT\s+OR\s+REPLACE\s+INTO\s+password_resets\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
      'INSERT INTO password_resets ($1) VALUES ($2) ON CONFLICT (token) DO UPDATE SET email = EXCLUDED.email, expires_at = EXCLUDED.expires_at, used = EXCLUDED.used'
    );
  }

  return text;
}

export const db = {
  prepare: (sql: string) => {
    const text = transformSql(sql);
    return {
      all: async (...args: any[]) => {
        const flatArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const res = await pool.query(text, flatArgs);
        return res.rows;
      },
      get: async (...args: any[]) => {
        const flatArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const res = await pool.query(text, flatArgs);
        return res.rows[0] || undefined;
      },
      run: async (...args: any[]) => {
        const flatArgs = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const res = await pool.query(text, flatArgs);
        return { changes: res.rowCount };
      },
    };
  },
  exec: async (sql: string) => {
    return await pool.query(sql);
  },
};

export async function initDatabase() {
  await pool.query('SELECT 1');
  console.log('[PostgreSQL] Conexión establecida correctamente.');
}
