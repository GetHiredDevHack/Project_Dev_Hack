const { v4: uuidv4 } = require('uuid')

const FARE_BY_TYPE = { Adult: 310, Youth: 230, Senior: 155, 'Post-Sec': 310, 'Child': 0 }
const ANTI_PASSBACK_MS  = 5 * 60 * 1000    // 5 min NFC lock
const RESCAN_LOCK_MS    = 5 * 60 * 1000    // 5 min QR rescan block (matches NFC anti-passback)
const GUEST_QR_WINDOW   = 90 * 60 * 1000   // 90 min from first tap

// ── NFC scan logic ─────────────────────────────────────────────────────────
function processNFCScan(db, userId, location) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) return { accepted: false, reason: 'User not found.' }

  const fare = FARE_BY_TYPE[user.account_type] || 310

  // Anti-passback: check if card was recently scanned
  if (user.card_locked_until) {
    const lockUntil = new Date(user.card_locked_until).getTime()
    if (Date.now() < lockUntil) {
      const mins = Math.ceil((lockUntil - Date.now()) / 60000)
      logScan(db, userId, 'nfc', location, fare, false, `Anti-passback lock (${mins}min remaining)`, 0)
      return { accepted: false, reason: `Card locked for ${mins} more minute(s). Anti-passback active.` }
    }
  }

  // ── Check for an active pass first ───────────────────────────────────────
  // Auto-expire stale passes
  db.prepare(`UPDATE user_passes SET status='expired' WHERE user_id=? AND expires_at < datetime('now') AND status='active'`).run(userId)
  const activePass = db.prepare(`SELECT * FROM user_passes WHERE user_id=? AND status='active' ORDER BY expires_at ASC LIMIT 1`).get(userId)

  let paymentMethod = 'balance'
  let passName = null

  if (activePass) {
    // Pass covers this ride — no balance deduction
    paymentMethod = 'pass'
    passName = activePass.pass_name
  } else {
    // No active pass — check e-cash balance
    if (user.balance_cents < fare) {
      logScan(db, userId, 'nfc', location, fare, false, 'Insufficient balance, no active pass', 0)
      return { accepted: false, reason: 'Insufficient balance and no active pass.' }
    }
    db.prepare(`UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?`).run(fare, userId)
  }

  // ── Device heartbeat fraud check ──────────────────────────────────────
  const recentOther = db.prepare(`
    SELECT * FROM scan_log
    WHERE account_id != ? AND scanned_at > datetime('now', '-5 minutes') AND scan_type = 'qr_guest'
    LIMIT 1
  `).get(userId)
  const fraudFlag = recentOther ? 1 : 0
  if (fraudFlag) {
    db.prepare(`UPDATE users SET fraud_flags = fraud_flags + 1 WHERE id = ?`).run(userId)
  }

  // Lock card (anti-passback)
  const lockUntil = new Date(Date.now() + ANTI_PASSBACK_MS).toISOString()
  db.prepare(`UPDATE users SET card_locked_until = ? WHERE id = ?`).run(lockUntil, userId)

  // Log scan
  const desc = paymentMethod === 'pass'
    ? `NFC Tap — ${location} (${passName})`
    : `NFC Tap — ${location}`
  const scanId = logScan(db, userId, 'nfc', location, paymentMethod === 'pass' ? 0 : fare, true, null, fraudFlag)

  // Transaction record (fare = 0 if covered by pass)
  db.prepare(`INSERT INTO transactions (id, user_id, type, description, amount_cents, related_id) VALUES (?, ?, 'ride', ?, ?, ?)`)
    .run(uuidv4(), userId, desc, paymentMethod === 'pass' ? 0 : -fare, scanId)

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  return {
    accepted: true,
    fareCents: paymentMethod === 'pass' ? 0 : fare,
    newBalanceCents: updatedUser.balance_cents,
    paymentMethod,
    passName,
  }
}

// ── Guest QR scan logic ────────────────────────────────────────────────────
function processGuestQRScan(db, tokenId, location) {
  const token = db.prepare('SELECT * FROM gift_tokens WHERE id = ?').get(tokenId)
  if (!token) return { accepted: false, reason: 'Token not found.' }

  const now = Date.now()

  // Expiry check (only applies after first scan — 90 min from first tap)
  if (token.first_scanned_at) {
    const expiry = new Date(token.first_scanned_at).getTime() + GUEST_QR_WINDOW
    if (now > expiry) {
      db.prepare(`UPDATE gift_tokens SET status='expired' WHERE id=?`).run(tokenId)
      logScan(db, tokenId, 'qr_guest', location, token.fare_cents, false, 'Token expired (90min)', 0)
      return { accepted: false, reason: 'Guest pass expired (90 min after first use).' }
    }
    // Rescan lock: block re-scan within 5 min
    const rescanLock = new Date(token.last_scanned_at).getTime() + RESCAN_LOCK_MS
    if (now < rescanLock) {
      const mins = Math.ceil((rescanLock - now) / 60000)
      logScan(db, tokenId, 'qr_guest', location, token.fare_cents, false, `Rescan lock (${mins}min)`, 1)
      return { accepted: false, reason: `Already scanned. Rescan blocked for ${mins} more minute(s).`, fraudAttempt: true }
    }
  }

  // First scan — start the 90-min clock
  const nowIso = new Date().toISOString()
  if (!token.first_scanned_at) {
    db.prepare(`UPDATE gift_tokens SET first_scanned_at=?, last_scanned_at=?, scan_count=scan_count+1, status='active' WHERE id=?`)
      .run(nowIso, nowIso, tokenId)
  } else {
    db.prepare(`UPDATE gift_tokens SET last_scanned_at=?, scan_count=scan_count+1 WHERE id=?`)
      .run(nowIso, tokenId)
  }

  logScan(db, tokenId, 'qr_guest', location, token.fare_cents, true, null, 0)
  return { accepted: true, fareCents: token.fare_cents }
}

// ── Create gift token ──────────────────────────────────────────────────────
function createGiftToken(db, senderId, recipientType, recipientUserId, recipientEmail, recipientPhone, fareCents, contactId) {
  const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(senderId)
  if (!sender) return { success: false, error: 'Sender not found.' }
  if (sender.balance_cents < fareCents) return { success: false, error: 'Insufficient balance.' }

  const tokenId = 'GT-' + uuidv4().replace(/-/g,'').slice(0,10).toUpperCase()
  // For guest tokens, expiry is set generously far — actual 90-min window starts on first scan
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() // 7 days outer limit

  db.prepare(`
    INSERT INTO gift_tokens (id, sender_id, recipient_type, recipient_user_id, recipient_email, recipient_phone, fare_cents, status, expires_at, contact_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(tokenId, senderId, recipientType, recipientUserId || null, recipientEmail || null, recipientPhone || null, fareCents, expiresAt, contactId || null)

  // Deduct from sender
  db.prepare(`UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?`).run(fareCents, senderId)

  // Transaction record for sender
  const desc = recipientType === 'guest'
    ? `Guest pass sent to ${recipientEmail}`
    : `Fare gifted to ${recipientEmail || recipientPhone}`
  db.prepare(`INSERT INTO transactions (id, user_id, type, description, amount_cents, related_id) VALUES (?, ?, 'gift_sent', ?, ?, ?)`)
    .run(uuidv4(), senderId, desc, -fareCents, tokenId)

  // If recipient is a known user, credit them immediately
  if (recipientType === 'user' && recipientUserId) {
    db.prepare(`UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?`).run(fareCents, recipientUserId)
    db.prepare(`INSERT INTO transactions (id, user_id, type, description, amount_cents, related_id) VALUES (?, ?, 'gift_received', ?, ?, ?)`)
      .run(uuidv4(), recipientUserId, `Fare received from ${sender.name}`, fareCents, tokenId)
    db.prepare(`UPDATE gift_tokens SET status='used', scan_count=1 WHERE id=?`).run(tokenId)
  }

  return { success: true, tokenId }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function logScan(db, accountId, scanType, location, fareCents, accepted, rejectReason, fraudFlag) {
  const id = uuidv4()
  db.prepare(`INSERT INTO scan_log (id, account_id, scan_type, location, fare_cents, accepted, reject_reason, fraud_flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, accountId, scanType, location, fareCents, accepted ? 1 : 0, rejectReason || null, fraudFlag)
  return id
}

module.exports = { processNFCScan, processGuestQRScan, createGiftToken, FARE_BY_TYPE }
