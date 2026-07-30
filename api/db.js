import { sql } from '@vercel/postgres';

export async function queryPostgres(queryString, params = []) {
  try {
    const result = await sql.query(queryString, params);
    return result;
  } catch (error) {
    console.error('PostgreSQL Query Error:', error);
    throw error;
  }
}

export { sql };
