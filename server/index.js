const express = require('express')
const cors    = require('cors')
const { v4: uuidv4 } = require('uuid')
const { initDb } = require('./db')
const { processNFCScan, processGuestQRScan, createGiftToken, FARE_BY_TYPE } = require('./logic')


const app = express()
let db

app.use(cors())
app.use(express.json())

// ── Helpers ────────────────────────────────────────────────────────────────
const centsToDisplay = c => (c / 100).toFixed(2)
const centsToDollars = c => c / 100

function formatUser(u) {
  return {
    id:            u.id,
    name:          u.name,
    email:         u.email,
    accountType:   u.account_type,
    peggoId:       u.peggo_id,
    photoInitials: u.photo_initials,
    photoColor:    u.photo_color,
    balance:       centsToDollars(u.balance_cents),
    balanceCents:  u.balance_cents,
    linkedCard:    !!u.linked_card,
    fraudFlags:    u.fraud_flags,
    cardLockedUntil: u.card_locked_until,
    poolId:        u.pool_id,
    poolRole:      u.pool_role,
    dateOfBirth:   u.date_of_birth,
    createdAt:     u.created_at,
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body
  const emailClean = (email || '').trim().toLowerCase()
  // Support login by email OR peggo card number
  let user = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash = ?').get(emailClean, password)
  if (!user) {
    // Try peggo card number (case-insensitive)
    user = db.prepare('SELECT * FROM users WHERE peggo_id = ? AND password_hash = ?').get(email.trim().toUpperCase(), password)
  }
  if (!user) return res.status(401).json({ error: 'Invalid credentials. Use your email or Peggo card number.' })
  res.json({ user: formatUser(user) })
})

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, accountType, dateOfBirth } = req.body
  // ── Validation ──
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' })
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  if (!/\d/.test(password)) return res.status(400).json({ error: 'Password must contain at least one number.' })
  if (!/[a-zA-Z]/.test(password)) return res.status(400).json({ error: 'Password must contain at least one letter.' })
  if (!dateOfBirth) return res.status(400).json({ error: 'Date of birth is required.' })
  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime()) || dob > new Date()) return res.status(400).json({ error: 'Invalid date of birth.' })

  const id = 'usr_' + uuidv4().slice(0,8)
  const initials = name.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  const colors = ['#1565ff','#00d68f','#ffb800','#9b5de5','#ff6b6b']
  const color  = colors[Math.floor(Math.random() * colors.length)]
  // Generate a unique 10-digit numeric Peggo card number
  const peggoId = String(Math.floor(1000000000 + Math.random() * 9000000000))
  try {
    db.prepare(`INSERT INTO users (id,name,email,password_hash,account_type,peggo_id,photo_initials,photo_color,balance_cents,date_of_birth) VALUES (?,?,?,?,?,?,?,?,0,?)`)
      .run(id, name.trim(), email.trim().toLowerCase(), password, accountType || 'Adult', peggoId, initials, color, dateOfBirth || null)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    res.json({ user: formatUser(user) })
  } catch (e) {
    res.status(400).json({ error: 'Email already in use.' })
  }
})

// ── User profile ───────────────────────────────────────────────────────────
app.get('/api/user/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'Not found.' })
  res.json({ user: formatUser(user) })
})

app.patch('/api/user/:id', (req, res) => {
  const { name, email } = req.body
  try {
    if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.params.id)
    if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim(), req.params.id)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    res.json({ user: formatUser(user) })
  } catch (e) {
    res.status(400).json({ error: 'Email already in use.' })
  }
})

// ── Transactions ───────────────────────────────────────────────────────────
app.get('/api/user/:id/transactions', (req, res) => {
  const txs = db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`).all(req.params.id)
  res.json({ transactions: txs.map(t => ({ ...t, amount: centsToDollars(t.amount_cents) })) })
})

// ── Top-up (with payment) ─────────────────────────────────────────────────
app.post('/api/user/:id/topup', (req, res) => {
  const { amountCents, cardNumber, cardExpiry, cardCvv, cardName } = req.body
  // Validate payment details are present
  if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
    return res.status(400).json({ error: 'Payment details required.' })
  }
  // Basic validation (demo — not real payment processing)
  const cleanCard = (cardNumber || '').replace(/\s/g, '')
  if (cleanCard.length < 13 || cleanCard.length > 19) {
    return res.status(400).json({ error: 'Invalid card number.' })
  }
  if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    return res.status(400).json({ error: 'Invalid expiry (use MM/YY).' })
  }
  // Check if card is expired
  const [expMonth, expYear] = cardExpiry.split('/').map(Number)
  if (expMonth < 1 || expMonth > 12) {
    return res.status(400).json({ error: 'Invalid expiry month.' })
  }
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear() % 100
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return res.status(400).json({ error: 'This card has expired.' })
  }
  if (!/^\d{3,4}$/.test(cardCvv)) {
    return res.status(400).json({ error: 'Invalid CVV.' })
  }
  if (!amountCents || amountCents < 500) {
    return res.status(400).json({ error: 'Minimum top-up is $5.00.' })
  }

  // In production, this is where you'd call Stripe/Square/etc.
  // For demo, we simulate a successful charge.
  db.prepare(`UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?`).run(amountCents, req.params.id)
  const last4 = cleanCard.slice(-4)
  db.prepare(`INSERT INTO transactions (id, user_id, type, description, amount_cents) VALUES (?, ?, 'topup', ?, ?)`)
    .run(uuidv4(), req.params.id, `Top-Up via card ending ${last4}`, amountCents)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  res.json({ user: formatUser(user) })
})

// ── Link existing Peggo card ──────────────────────────────────────────────
app.post('/api/user/:id/link-card', (req, res) => {
  const { peggoId } = req.body
  const clean = (peggoId || '').replace(/\s/g, '')
  if (!clean || !/^\d{10}$/.test(clean)) {
    return res.status(400).json({ error: 'Invalid card number — must be exactly 10 digits.' })
  }
  const existing = db.prepare('SELECT * FROM users WHERE peggo_id = ? AND id != ?').get(clean, req.params.id)
  if (existing) {
    return res.status(400).json({ error: 'This Peggo card is already linked to another account.' })
  }
  db.prepare('UPDATE users SET peggo_id = ?, linked_card = 1 WHERE id = ?').run(clean, req.params.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  res.json({ user: formatUser(user) })
})

// ── Unlink Peggo card ─────────────────────────────────────────────────────
app.post('/api/user/:id/unlink-card', (req, res) => {
  db.prepare('UPDATE users SET peggo_id = NULL, linked_card = 0 WHERE id = ?').run(req.params.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  res.json({ user: formatUser(user) })
})

// ── Passes ─────────────────────────────────────────────────────────────────
app.get('/api/user/:id/passes', (req, res) => {
  // Auto-expire old passes first
  db.prepare(`UPDATE user_passes SET status='expired' WHERE user_id=? AND expires_at < datetime('now') AND status='active'`).run(req.params.id)
  const passes = db.prepare(`SELECT * FROM user_passes WHERE user_id=? ORDER BY activated_at DESC`).all(req.params.id)
  res.json({ passes })
})

app.post('/api/user/:id/passes/buy', (req, res) => {
  const { passId, passName, priceCents, durationDays, paidVia, cardNumber, cardExpiry, cardCvv, cardName } = req.body
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found.' })

  // If paying from balance, check funds
  if (paidVia === 'balance') {
    if (user.balance_cents < priceCents) {
      return res.status(400).json({ error: 'Insufficient balance.' })
    }
    db.prepare(`UPDATE users SET balance_cents = balance_cents - ? WHERE id=?`).run(priceCents, req.params.id)
  } else {
    // Card payment: validate fields present (demo — no real charge)
    if (!cardNumber || !cardExpiry || !cardCvv || !cardName) {
      return res.status(400).json({ error: 'Payment details required.' })
    }
  }

  const expiresAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString()
  const passRow = { id: uuidv4(), user_id: req.params.id, pass_id: passId, pass_name: passName,
    account_type: user.account_type, price_cents: priceCents, paid_via: paidVia, expires_at: expiresAt }

  db.prepare(`INSERT INTO user_passes (id,user_id,pass_id,pass_name,account_type,price_cents,paid_via,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(passRow.id, passRow.user_id, passRow.pass_id, passRow.pass_name,
    passRow.account_type, passRow.price_cents, passRow.paid_via, passRow.expires_at)

  // Transaction record
  const last4 = paidVia === 'balance' ? null : (cardNumber || '').replace(/\s/g,'').slice(-4)
  const desc = paidVia === 'balance' ? `${passName} — paid from balance` : `${passName} — card ···${last4}`
  db.prepare(`INSERT INTO transactions (id,user_id,type,description,amount_cents,related_id) VALUES (?,?,?,?,?,?)`)
    .run(uuidv4(), req.params.id, 'pass', desc, -priceCents, passRow.id)

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  res.json({ success: true, pass: passRow, user: formatUser(updatedUser) })
})

// ── NFC scan ───────────────────────────────────────────────────────────────
app.post('/api/scan/nfc', (req, res) => {
  const { userId, location } = req.body
  const result = processNFCScan(db, userId, location || 'Unknown Route')
  if (result.accepted) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    return res.json({ ...result, newBalance: centsToDollars(result.newBalanceCents), user: formatUser(user) })
  }
  res.json(result)
})

// ── Guest QR scan ──────────────────────────────────────────────────────────
app.post('/api/scan/qr', (req, res) => {
  const { tokenId, location } = req.body
  const result = processGuestQRScan(db, tokenId, location || 'Unknown Route')
  const token  = db.prepare('SELECT * FROM gift_tokens WHERE id = ?').get(tokenId)
  res.json({ ...result, token: token ? formatToken(token) : null })
})

// ── Gift: lookup recipient user by email or phone ──────────────────────────
app.get('/api/users/lookup', (req, res) => {
  const { email, phone } = req.query
  let user = null
  if (email) user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user && phone) user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  if (!user) return res.json({ found: false })
  res.json({ found: true, user: formatUser(user) })
})

// ── Gift: send ─────────────────────────────────────────────────────────────
app.post('/api/gift/send', (req, res) => {
  const { senderId, recipientType, recipientUserId, recipientEmail, recipientPhone, fareCents, contactId, saveContact, contactLabel } = req.body
  const result = createGiftToken(db, senderId, recipientType, recipientUserId, recipientEmail, recipientPhone, fareCents, contactId)
  if (!result.success) return res.status(400).json({ error: result.error })

  // Optionally save as new contact
  if (saveContact && (recipientEmail || recipientPhone)) {
    try {
      const initials = (contactLabel || recipientEmail || recipientPhone).slice(0,2).toUpperCase()
      db.prepare(`INSERT INTO contacts (id, owner_id, label, email, phone, color, initials) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), senderId, contactLabel || recipientEmail || recipientPhone, recipientEmail||null, recipientPhone||null, '#4d8aff', initials)
    } catch(_) { /* duplicate — ignore */ }
  }

  const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(senderId)
  const token  = db.prepare('SELECT * FROM gift_tokens WHERE id = ?').get(result.tokenId)

  res.json({ success: true, tokenId: result.tokenId, sender: formatUser(sender), token: formatToken(token) })
})

// ── Contacts ───────────────────────────────────────────────────────────────
app.get('/api/user/:id/contacts', (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts WHERE owner_id = ? ORDER BY label').all(req.params.id)
  res.json({ contacts })
})

app.post('/api/user/:id/contacts', (req, res) => {
  const { label, email, phone, color, initials } = req.body
  const id = uuidv4()
  try {
    db.prepare(`INSERT INTO contacts (id, owner_id, label, email, phone, color, initials) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.params.id, label, email||null, phone||null, color||'#4d8aff', initials||label.slice(0,2).toUpperCase())
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id)
    res.json({ contact })
  } catch (e) {
    res.status(400).json({ error: 'Contact already exists.' })
  }
})

app.delete('/api/contacts/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ── Pool ───────────────────────────────────────────────────────────────────
app.get('/api/pool/:id', (req, res) => {
  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(req.params.id)
  if (!pool) return res.status(404).json({ error: 'Pool not found.' })
  const members = db.prepare('SELECT * FROM users WHERE pool_id = ?').all(pool.id).map(formatUser)
  res.json({ pool: { ...pool, sharedBalance: centsToDollars(pool.shared_balance_cents) }, members })
})

// Create a new pool
app.post('/api/pool/create', (req, res) => {
  const { headId, name } = req.body
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Pool name must be at least 2 characters.' })
  const head = db.prepare('SELECT * FROM users WHERE id = ?').get(headId)
  if (!head) return res.status(404).json({ error: 'User not found.' })
  if (head.pool_id) return res.status(400).json({ error: 'You are already in a pool. Leave it first.' })
  const poolId = 'pool_' + uuidv4().slice(0,8)
  db.prepare('INSERT INTO pools (id, name, head_id, shared_balance_cents) VALUES (?, ?, ?, 0)').run(poolId, name.trim(), headId)
  db.prepare("UPDATE users SET pool_id=?, pool_role='head' WHERE id=?").run(poolId, headId)
  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(poolId)
  const members = db.prepare('SELECT * FROM users WHERE pool_id = ?').all(poolId).map(formatUser)
  res.json({ pool: { ...pool, sharedBalance: 0 }, members })
})

// Add member to pool by email
app.post('/api/pool/:id/add-member', (req, res) => {
  const { email, requesterId } = req.body
  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(req.params.id)
  if (!pool) return res.status(404).json({ error: 'Pool not found.' })
  if (pool.head_id !== requesterId) return res.status(403).json({ error: 'Only the pool owner can add members.' })
  if (!email) return res.status(400).json({ error: 'Email is required.' })
  const target = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
  if (!target) return res.status(404).json({ error: 'No account found with that email.' })
  if (target.pool_id) return res.status(400).json({ error: `${target.name} is already in a pool.` })
  if (target.id === pool.head_id) return res.status(400).json({ error: 'You are already the pool owner.' })
  db.prepare("UPDATE users SET pool_id=?, pool_role='member' WHERE id=?").run(pool.id, target.id)
  const members = db.prepare('SELECT * FROM users WHERE pool_id = ?').all(pool.id).map(formatUser)
  res.json({ pool: { ...pool, sharedBalance: centsToDollars(pool.shared_balance_cents) }, members })
})

// Remove member from pool
app.post('/api/pool/:id/remove-member', (req, res) => {
  const { memberId, requesterId } = req.body
  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(req.params.id)
  if (!pool) return res.status(404).json({ error: 'Pool not found.' })
  if (pool.head_id !== requesterId) return res.status(403).json({ error: 'Only the pool owner can remove members.' })
  if (memberId === pool.head_id) return res.status(400).json({ error: 'Cannot remove the pool owner. Delete the pool instead.' })
  db.prepare("UPDATE users SET pool_id=NULL, pool_role=NULL WHERE id=? AND pool_id=?").run(memberId, pool.id)
  const members = db.prepare('SELECT * FROM users WHERE pool_id = ?').all(pool.id).map(formatUser)
  res.json({ pool: { ...pool, sharedBalance: centsToDollars(pool.shared_balance_cents) }, members })
})

// Update pool name
app.post('/api/pool/:id/rename', (req, res) => {
  const { name, requesterId } = req.body
  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(req.params.id)
  if (!pool) return res.status(404).json({ error: 'Pool not found.' })
  if (pool.head_id !== requesterId) return res.status(403).json({ error: 'Only the pool owner can rename.' })
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters.' })
  db.prepare('UPDATE pools SET name = ? WHERE id = ?').run(name.trim(), pool.id)
  const updated = db.prepare('SELECT * FROM pools WHERE id = ?').get(pool.id)
  const members = db.prepare('SELECT * FROM users WHERE pool_id = ?').all(pool.id).map(formatUser)
  res.json({ pool: { ...updated, sharedBalance: centsToDollars(updated.shared_balance_cents) }, members })
})

// Leave / delete pool
app.post('/api/pool/:id/leave', (req, res) => {
  const { userId } = req.body
  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(req.params.id)
  if (!pool) return res.status(404).json({ error: 'Pool not found.' })
  if (pool.head_id === userId) {
    // Owner leaving = delete pool, remove all members
    db.prepare("UPDATE users SET pool_id=NULL, pool_role=NULL WHERE pool_id=?").run(pool.id)
    db.prepare('DELETE FROM pools WHERE id = ?').run(pool.id)
    return res.json({ deleted: true })
  }
  db.prepare("UPDATE users SET pool_id=NULL, pool_role=NULL WHERE id=? AND pool_id=?").run(userId, pool.id)
  res.json({ left: true })
})

// ── Gift token status ──────────────────────────────────────────────────────
app.get('/api/gift/:tokenId', (req, res) => {
  const token = db.prepare('SELECT * FROM gift_tokens WHERE id = ?').get(req.params.tokenId)
  if (!token) return res.status(404).json({ error: 'Not found.' })
  res.json({ token: formatToken(token) })
})

// ── Admin routes ───────────────────────────────────────────────────────────
app.get('/api/admin/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all().map(formatUser)
  res.json({ users })
})

app.get('/api/admin/fraud', (req, res) => {
  const flags = db.prepare(`
    SELECT s.*, u.name, u.email, u.account_type
    FROM scan_log s
    LEFT JOIN users u ON u.id = s.account_id
    WHERE s.fraud_flag = 1
    ORDER BY s.scanned_at DESC
    LIMIT 50
  `).all()
  res.json({ flags })
})

app.get('/api/admin/scans', (req, res) => {
  const scans = db.prepare(`SELECT * FROM scan_log ORDER BY scanned_at DESC LIMIT 100`).all()
  res.json({ scans })
})

app.get('/api/admin/tokens', (req, res) => {
  const tokens = db.prepare(`
    SELECT t.*, u.name as sender_name FROM gift_tokens t
    LEFT JOIN users u ON u.id = t.sender_id
    ORDER BY t.created_at DESC LIMIT 50
  `).all()
  res.json({ tokens: tokens.map(formatToken) })
})

app.post('/api/admin/clear-flag/:userId', (req, res) => {
  db.prepare(`UPDATE users SET fraud_flags = 0 WHERE id = ?`).run(req.params.userId)
  res.json({ success: true })
})

// ── Format helpers ─────────────────────────────────────────────────────────
function formatToken(t) {
  const now = Date.now()
  let expiresAt = t.expires_at
  let minsRemaining = null

  if (t.first_scanned_at) {
    const expiry = new Date(t.first_scanned_at).getTime() + 90 * 60 * 1000
    expiresAt = new Date(expiry).toISOString()
    minsRemaining = Math.max(0, Math.ceil((expiry - now) / 60000))
  }

  return {
    id:              t.id,
    senderId:        t.sender_id,
    senderName:      t.sender_name || null,
    recipientType:   t.recipient_type,
    recipientUserId: t.recipient_user_id,
    recipientEmail:  t.recipient_email,
    recipientPhone:  t.recipient_phone,
    fare:            centsToDollars(t.fare_cents),
    fareCents:       t.fare_cents,
    status:          t.status,
    createdAt:       t.created_at,
    expiresAt,
    firstScannedAt:  t.first_scanned_at,
    lastScannedAt:   t.last_scanned_at,
    scanCount:       t.scan_count,
    minsRemaining,
  }
}

async function start() {
  db = await initDb()
  const PORT = 3001
  app.listen(PORT, () => console.log(`🚌 TransitLink API running on http://localhost:${PORT}`))
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
