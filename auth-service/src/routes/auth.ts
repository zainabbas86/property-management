import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../db'

const router = Router()

interface UserRow extends RowDataPacket {
  id: number
  name: string
  email: string
  password: string
}

interface AuthBody {
  name?: string
  email?: string
  password?: string
}

interface JwtPayload extends jwt.JwtPayload {
  sub: number
  name: string
  email: string
}

function sign(user: { id: number; name: string; email: string }): string {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' },
  )
}

router.post('/register', async (req: Request<object, object, AuthBody>, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      res.status(422).json({ message: 'name, email, and password are required.' })
      return
    }
    if (password.length < 8) {
      res.status(422).json({ errors: { password: ['Must be at least 8 characters.'] } })
      return
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email],
    )
    if (existing.length > 0) {
      res.status(422).json({ errors: { email: ['The email has already been taken.'] } })
      return
    }

    const hashed = await bcrypt.hash(password, 12)
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [name, email, hashed],
    )

    const user = { id: result.insertId, name, email }
    res.status(201).json({ user, token: sign(user) })
  } catch (err) {
    console.error('register:', (err as Error).message)
    res.status(500).json({ message: 'Server error.' })
  }
})

router.post('/login', async (req: Request<object, object, AuthBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(422).json({ message: 'email and password are required.' })
      return
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email],
    )
    const row = rows[0]

    if (!row || !(await bcrypt.compare(password, row.password))) {
      res.status(422).json({ errors: { email: ['The provided credentials are incorrect.'] } })
      return
    }

    const user = { id: row.id, name: row.name, email: row.email }
    res.json({ user, token: sign(user) })
  } catch (err) {
    console.error('login:', (err as Error).message)
    res.status(500).json({ message: 'Server error.' })
  }
})

// JWT is stateless — the client simply discards the token on logout
router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ message: 'Logged out successfully.' })
})

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
