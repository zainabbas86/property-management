import amqp from 'amqplib'
import { pool } from '../db'

const QUEUE = 'users.migration'

interface MigrationPayload {
  id: number
  name: string
  email: string
  password: string
}

async function connectWithRetry(retries = 10, delayMs = 3000): Promise<amqp.Connection> {
  for (let i = 0; i < retries; i++) {
    try {
      return await amqp.connect(process.env.RABBITMQ_URL!)
    } catch {
      if (i === retries - 1) throw new Error('Could not connect to RabbitMQ after retries')
      console.log(`[migration] RabbitMQ not ready, retrying in ${delayMs}ms…`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error('Unreachable')
}

export async function startMigrationConsumer(): Promise<void> {
  const conn = await connectWithRetry()
  const ch = await conn.createChannel()

  await ch.assertQueue(QUEUE, { durable: true })
  ch.prefetch(10)

  console.log(`[migration] consuming queue "${QUEUE}" — NO userCreated events will fire`)

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return
    try {
      const user = JSON.parse(msg.content.toString()) as MigrationPayload

      // Preserve the original MySQL id so existing JWTs (sub claim) stay valid.
      await pool.query(
        `INSERT INTO users (id, name, email, password)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.email, user.password],
      )

      // Keep the BIGSERIAL sequence ahead of the highest migrated id so future
      // inserts do not collide with migrated records.
      await pool.query(
        `SELECT setval(
           pg_get_serial_sequence('users', 'id'),
           GREATEST($1::bigint, (SELECT last_value FROM users_id_seq))
         )`,
        [user.id],
      )

      ch.ack(msg)
      console.log(`[migration] imported user ${user.id} <${user.email}>`)
    } catch (err) {
      console.error('[migration] failed, nacking message:', err)
      ch.nack(msg, false, false)
    }
  })
}
