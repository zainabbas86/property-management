import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/auth', authRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => console.log(`auth-service listening on :${PORT}`))
