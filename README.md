# TransitLink Winnipeg
**Full-stack: Express + SQLite backend · React frontend**

## Quick Start

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both server + client (concurrently)
npm run dev
```

- **App:** http://localhost:5173
- **API:** http://localhost:3001
- **Admin:** http://localhost:5173/#/admin

## Demo Accounts (password: `password`)
| Email | User | Notes |
|-------|------|-------|
| maya@example.com | Maya Swiftwind | Adult, Family Pool Head |
| liam@example.com | Liam Swiftwind | Youth, Family Member |
| darnell@example.com | Darnell Brooks | Post-Sec, Low balance |
| grace@example.com | Grace Okafor | Senior, 1 fraud flag |

## Database (SQLite — `server/transitlink.db`)
| Table | Purpose |
|-------|---------|
| `users` | Accounts, balance (cents), NFC lock, fraud flags |
| `contacts` | Saved recipients per user |
| `pools` | Family/work shared balances |
| `gift_tokens` | All gifts — user-to-user and guest QR |
| `scan_log` | Every NFC + QR scan with fraud flags |
| `transactions` | Ledger of all money movements |

## Gifting Logic
- **Registered User** — look up by email/phone; fare added to their balance instantly
- **Guest (no account)** — QR code emailed; 90-min window from **first tap**; 10-min rescan lock
- **Save as Contact** — option to save any one-time recipient for future use
- **Fraud** — simultaneous card+QR scan within 5 min flags the account

## Security
- NFC: 15-min anti-passback lock after every scan
- Guest QR: 10-min rescan lock; expires 90 min after first tap
- Admin portal at `/#/admin` — separate URL, not in main nav
