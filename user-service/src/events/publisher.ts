import amqp from 'amqplib'

const EXCHANGE = 'app.events'
let channel: amqp.Channel | null = null

async function connectWithRetry(retries = 10, delayMs = 3000): Promise<amqp.Connection> {
  for (let i = 0; i < retries; i++) {
    try {
      return await amqp.connect(process.env.RABBITMQ_URL!)
    } catch {
      if (i === retries - 1) throw new Error('Could not connect to RabbitMQ after retries')
      console.log(`[publisher] RabbitMQ not ready, retrying in ${delayMs}ms…`)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw new Error('Unreachable')
}

export async function initPublisher(): Promise<void> {
  const conn = await connectWithRetry()
  channel = await conn.createChannel()
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
  console.log(`[publisher] ready on exchange "${EXCHANGE}"`)
}

// Fire-and-forget — callers do NOT await this.
// Not called during bulk migration; only on real user-created actions.
export function publishEvent(routingKey: string, data: Record<string, unknown>): void {
  if (!channel) {
    console.warn(`[publisher] channel not ready, dropping event: ${routingKey}`)
    return
  }
  const payload = JSON.stringify({ eventType: routingKey, timestamp: new Date().toISOString(), data })
  channel.publish(EXCHANGE, routingKey, Buffer.from(payload), { persistent: true })
}
