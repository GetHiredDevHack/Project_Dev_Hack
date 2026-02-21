const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, 'transitlink.db')

/**
 * Wrapper around sql.js to mimic the better-sqlite3 API.
 * This lets logic.js and index.js work without changes.
 */
function createDbWrapper(sqliteDb) {
  // Auto-save to disk after every write operation
  function save() {
    const data = sqliteDb.export()
    fs.writeFileSync(DB_PATH, Buffer.from(data))
  }

  const wrapper = {
    prepare(sql) {
      return {
        run(...params) {
          sqliteDb.run(sql, params)
          save()
          return this
        },
        get(...params) {
          const stmt = sqliteDb.prepare(sql)
          stmt.bind(params)
          if (stmt.step()) {
            const row = stmt.getAsObject()
            stmt.free()
            return row
          }
          stmt.free()
          return undefined
        },
        all(...params) {
          const results = []
          const stmt = sqliteDb.prepare(sql)
          stmt.bind(params)
          while (stmt.step()) {
            results.push(stmt.getAsObject())
          }
          stmt.free()
          return results
        }
      }
    },
    exec(sql) {
      sqliteDb.run(sql)
      save()
    },
    pragma(pragmaStr) {
      try {
        sqliteDb.run(`PRAGMA ${pragmaStr}`)
      } catch (_) {
        // some pragmas may not be supported in sql.js — ignore
      }
    }
  }

  return wrapper
}

async function initDb() {
  const SQL = await initSqlJs()

  let sqliteDb
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    sqliteDb = new SQL.Database(fileBuffer)
  } else {
    sqliteDb = new SQL.Database()
  }

  const db = createDbWrapper(sqliteDb)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    -- ── Users ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      account_type  TEXT NOT NULL DEFAULT 'Adult',
      peggo_id      TEXT UNIQUE,
      photo_initials TEXT NOT NULL DEFAULT '??',
      photo_color   TEXT NOT NULL DEFAULT '#1565ff',
      balance_cents INTEGER NOT NULL DEFAULT 0,
      linked_card   INTEGER NOT NULL DEFAULT 0,
      fraud_flags   INTEGER NOT NULL DEFAULT 0,
      card_locked_until TEXT,
      pool_id       TEXT,
      pool_role     TEXT,
      date_of_birth TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Contacts (saved recipients per user) ─────────────────────────────
    CREATE TABLE IF NOT EXISTS contacts (
      id          TEXT PRIMARY KEY,
      owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      email       TEXT,
      phone       TEXT,
      color       TEXT NOT NULL DEFAULT '#4d8aff',
      initials    TEXT NOT NULL DEFAULT '?',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_id, email),
      UNIQUE(owner_id, phone)
    );

    -- ── Family / Work Pools ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pools (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      head_id               TEXT NOT NULL REFERENCES users(id),
      shared_balance_cents  INTEGER NOT NULL DEFAULT 0,
      auto_refill_threshold INTEGER NOT NULL DEFAULT 500,
      auto_refill_amount    INTEGER NOT NULL DEFAULT 2000,
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Gift Tokens ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS gift_tokens (
      id                TEXT PRIMARY KEY,
      sender_id         TEXT NOT NULL REFERENCES users(id),
      recipient_type    TEXT NOT NULL,
      recipient_user_id TEXT REFERENCES users(id),
      recipient_email   TEXT,
      recipient_phone   TEXT,
      is_one_time       INTEGER NOT NULL DEFAULT 1,
      fare_cents        INTEGER NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at        TEXT NOT NULL,
      first_scanned_at  TEXT,
      last_scanned_at   TEXT,
      scan_count        INTEGER NOT NULL DEFAULT 0,
      contact_id        TEXT REFERENCES contacts(id)
    );

    -- ── Scan Log (all NFC + QR scans) ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS scan_log (
      id          TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL,
      scan_type   TEXT NOT NULL,
      location    TEXT NOT NULL DEFAULT 'Unknown Route',
      fare_cents  INTEGER NOT NULL,
      accepted    INTEGER NOT NULL,
      reject_reason TEXT,
      scanned_at  TEXT NOT NULL DEFAULT (datetime('now')),
      fraud_flag  INTEGER NOT NULL DEFAULT 0
    );

    -- ── Transactions ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      type        TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      related_id  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── User Passes (e-passes stored separately from balance) ─────────────
    CREATE TABLE IF NOT EXISTS user_passes (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pass_id       TEXT NOT NULL,
      pass_name     TEXT NOT NULL,
      account_type  TEXT NOT NULL,
      price_cents   INTEGER NOT NULL,
      paid_via      TEXT NOT NULL,
      activated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active'
    );
  `)

  return db
}

module.exports = { initDb }
