import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'db',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_DATABASE ?? 'property_management',
  user: process.env.DB_USERNAME ?? 'laravel',
  password: process.env.DB_PASSWORD ?? 'secret',
  waitForConnections: true,
  connectionLimit: 10,
})

export default pool
