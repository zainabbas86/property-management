import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = Router()

const USER_SERVICE = process.env.USER_SERVICE_URL ?? 'http://user-service:3002'

interface UserRow {
  id: number
  name: string
  email: string
  password: string
}

interface JwtPayload extends jwt.JwtPayload {
  sub: number
  name: string
  email: string
}

interface AuthBody {
  name?: string
  email?: string
  password?: string
}

function sign(user: { id: number; name: string; email: string }): string {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' },
  )
}

router.post('/register', async (req: Request<object, object, AuthBody>, res: Response): Promise<void> => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    res.status(422).json({ message: 'name, email, and password are required.' })
    return
  }
  if (password.length < 8) {
    res.status(422).json({ errors: { password: ['Must be at least 8 characters.'] } })
    return
  }

  const hashed = await bcrypt.hash(password, 12)

  const userRes = await fetch(`${USER_SERVICE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: hashed }),
  })

  if (!userRes.ok) {
    const body = await userRes.json() as Record<string, unknown>
    res.status(userRes.status).json(body)
    return
  }

  const user = await userRes.json() as UserRow
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token: sign(user) })
})

router.post('/login', async (req: Request<object, object, AuthBody>, res: Response): Promise<void> => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(422).json({ message: 'email and password are required.' })
    return
  }

  const userRes = await fetch(`${USER_SERVICE}/users/email/${encodeURIComponent(email)}`)

  if (!userRes.ok) {
    res.status(422).json({ errors: { email: ['The provided credentials are incorrect.'] } })
    return
  }

  const user = await userRes.json() as UserRow

  if (!(await bcrypt.compare(password, user.password))) {
    res.status(422).json({ errors: { email: ['The provided credentials are incorrect.'] } })
    return
  }

  res.json({ user: { id: user.id, name: user.name, email: user.email }, token: sign(user) })
})

// JWT is stateless — the client discards the token; nothing to invalidate server-side
router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ message: 'Logged out successfully.' })
})

// /me returns data from the JWT payload — avoids a round-trip to user-service
router.get('/me', (req: Request, res: Response): void => {
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthenticated.' })
    return
  }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET as string) as JwtPayload
    res.json({ id: payload.sub, name: payload.name, email: payload.email })
  } catch {
    res.status(401).json({ message: 'Token invalid or expired.' })
  }
})

export default router
