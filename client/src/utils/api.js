const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  // Auth
  login:   (email, password)          => req('POST', '/auth/login', { email, password }),
  signup:  (name, email, password, accountType, dateOfBirth) => req('POST', '/auth/signup', { name, email, password, accountType, dateOfBirth }),

  // User
  getUser:  (id)        => req('GET',  `/user/${id}`),
  getTransactions: (id) => req('GET',  `/user/${id}/transactions`),
  topUp:    (id, data)  => req('POST', `/user/${id}/topup`, data),
  linkCard: (id, peggoId) => req('POST', `/user/${id}/link-card`, { peggoId }),
  unlinkCard: (id)      => req('POST', `/user/${id}/unlink-card`),

  // Profile
  updateProfile: (id, data)     => req('PATCH', `/user/${id}`, data),

  // Passes
  getPasses:  (userId)    => req('GET',  `/user/${userId}/passes`),
  buyPass:    (userId, data) => req('POST', `/user/${userId}/passes/buy`, data),

  getContacts:   (userId)       => req('GET',    `/user/${userId}/contacts`),
  addContact:    (userId, data) => req('POST',   `/user/${userId}/contacts`, data),
  deleteContact: (cid)          => req('DELETE', `/contacts/${cid}`),
  lookupUser:    (email)        => req('GET',    `/users/lookup?email=${encodeURIComponent(email)}`),

  // Gift
  sendGift: (data)    => req('POST', '/gift/send', data),
  getToken: (tokenId) => req('GET',  `/gift/${tokenId}`),

  // Scan
  nfcScan:  (userId, location)   => req('POST', '/scan/nfc', { userId, location }),
  qrScan:   (tokenId, location)  => req('POST', '/scan/qr',  { tokenId, location }),

  // Pool
  getPool:        (poolId)              => req('GET',  `/pool/${poolId}`),
  createPool:     (headId, name)        => req('POST', '/pool/create', { headId, name }),
  addPoolMember:  (poolId, email, requesterId) => req('POST', `/pool/${poolId}/add-member`, { email, requesterId }),
  removePoolMember: (poolId, memberId, requesterId) => req('POST', `/pool/${poolId}/remove-member`, { memberId, requesterId }),
  renamePool:     (poolId, name, requesterId) => req('POST', `/pool/${poolId}/rename`, { name, requesterId }),
  leavePool:      (poolId, userId)      => req('POST', `/pool/${poolId}/leave`, { userId }),

  // Admin
  adminUsers:  ()       => req('GET', '/admin/users'),
  adminFraud:  ()       => req('GET', '/admin/fraud'),
  adminScans:  ()       => req('GET', '/admin/scans'),
  adminTokens: ()       => req('GET', '/admin/tokens'),
  clearFlag:   (userId) => req('POST', `/admin/clear-flag/${userId}`),
}

const WPG = 'America/Winnipeg'

export function formatCurrency(dollars) {
  return '$' + Math.abs(dollars).toFixed(2)
}

export function timeAgo(iso) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: WPG, month:'short', day:'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-CA', { timeZone: WPG, month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12: true })
}

export function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-CA', { timeZone: WPG, hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDateLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const nowWpg   = new Date(new Date().toLocaleString('en-CA', { timeZone: WPG }))
  const dateWpg  = new Date(new Date(iso).toLocaleString('en-CA', { timeZone: WPG }))
  const todayStr = nowWpg.toDateString()
  const dateStr  = dateWpg.toDateString()
  const yest = new Date(nowWpg); yest.setDate(yest.getDate() - 1)
  if (dateStr === todayStr) return 'Today'
  if (dateStr === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-CA', { timeZone: WPG, weekday: 'short', month: 'short', day: 'numeric' })
}

export const TX_ICON = { ride:'🚌', gift_sent:'🎁', gift_received:'💚', topup:'💳', fraud:'⚠️', pass:'🎫' }
