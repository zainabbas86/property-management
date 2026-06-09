import { Router, Request, Response } from 'express'
import { pool } from '../db'
import { publishEvent } from '../events/publisher'

const router = Router()

// ── Internal ──────────────────────────────────────────────────────────────────
// Used by auth-service for login. Returns the password hash.
// This route must be declared BEFORE /:id to avoid Express matching "email" as an id.
router.get('/email/:email', async (req: Request, res: Response): Promise<void> => {
  const { rows } = await pool.query<{ id: number; name: string; email: string; password: string }>(
    'SELECT id, name, email, password FROM users WHERE email = $1',
    [req.params.email],
  )
  if (!rows[0]) {
    res.status(404).json({ message: 'User not found.' })
    return
  }
  res.json(rows[0])
})

// ── Public ────────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { rows } = await pool.query(
    'SELECT id, name, email, created_at FROM users WHERE id = $1',
    [req.params.id],
  )
  if (!rows[0]) {
    res.status(404).json({ message: 'User not found.' })
    return
  }
  res.json(rows[0])
})

// Creates a user and fires a userCreated event.
// NOT called during bulk migration — the migration consumer inserts directly
// into the DB to skip this event intentionally.
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string }
  if (!name || !email || !password) {
    res.status(422).json({ errors: { email: ['name, email, and password are required.'] } })
    return
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, password],
    )
    publishEvent('user.created', { id: rows[0].id, name: rows[0].name, email: rows[0].email })
    res.status(201).json(rows[0])
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(422).json({ errors: { email: ['Email already taken.'] } })
      return
    }
    throw err
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const { name, email } = req.body as { name?: string; email?: string }
  const { rows } = await pool.query(
    `UPDATE users
     SET    name       = COALESCE($2, name),
            email      = COALESCE($3, email),
            updated_at = NOW()
     WHERE  id = $1
     RETURNING id, name, email, created_at, updated_at`,
    [req.params.id, name ?? null, email ?? null],
  )
  if (!rows[0]) {
    res.status(404).json({ message: 'User not found.' })
    return
  }
  res.json(rows[0])
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
  if (!rowCount) {
    res.status(404).json({ message: 'User not found.' })
    return
  }
  res.status(204).send()
})

export default router
