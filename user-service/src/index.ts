import express from 'express'
import cors from 'cors'
import { runMigrations } from './db'
import { initPublisher } from './events/publisher'
import { startMigrationConsumer } from './consumers/migration'
import usersRouter from './routes/users'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }))
app.use('/users', usersRouter)

const PORT = Number(process.env.PORT ?? 3002)

async function start(): Promise<void> {
  await runMigrations()
  await initPublisher()
  await startMigrationConsumer()
  app.listen(PORT, () => console.log(`user-service listening on :${PORT}`))
}

start().catch((err) => {
  console.error('Failed to start user-service:', err)
  process.exit(1)
})
