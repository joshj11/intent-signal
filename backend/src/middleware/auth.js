import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  const token = header.slice(7)
  const secret = process.env.SUPABASE_JWT_SECRET

  if (!secret) {
    return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured' })
  }

  try {
    const payload = jwt.verify(token, secret)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
