import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE || 'guangzi',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
}

let pool

export function getPool() {
  if (!pool) pool = mysql.createPool(config)
  return pool
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params)
  return rows
}

export async function withConnection(fn) {
  const conn = await getPool().getConnection()
  try {
    return await fn(conn)
  } finally {
    conn.release()
  }
}

export { config as dbConfig }
