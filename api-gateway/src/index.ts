import express, { Request, Response } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { ServerResponse } from 'http'

const app = express()

function onError(err: Error, _req: Request, res: ServerResponse) {
  console.error('Proxy error:', err.message)
  res.writeHead(502, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'Upstream service unavailable.' }))
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway' })
})

// Express does NOT strip the path prefix when proxying, so /auth/login
// arrives at auth-service with its full path intact — no pathRewrite needed.
app.use('/auth', createProxyMiddleware({
  target: 'http://auth-service:3001',
  changeOrigin: true,
  onError,
}))

// /users/* → user-service  (note: /users/email/:email is internal — auth-service bypasses the gateway)
app.use('/users', createProxyMiddleware({
  target: 'http://user-service:3002',
  changeOrigin: true,
  onError,
}))

app.use('/api', createProxyMiddleware({
  target: 'http://backend:8000',
  changeOrigin: true,
  onError,
}))

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found.' })
})

const PORT = Number(process.env.PORT ?? 80)
app.listen(PORT, () => console.log(`api-gateway listening on :${PORT}`))
