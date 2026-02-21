const nodemailer = require('nodemailer')

let transporter = null

/**
 * Initialize the email transporter.
 * Uses Ethereal (free test SMTP) so emails are captured in a web inbox.
 */
async function initMailer() {
  const testAccount = await nodemailer.createTestAccount()

  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  })

  console.log('📧 Email ready (Ethereal test account)')
  console.log(`   View sent emails at: https://ethereal.email/login`)
  console.log(`   Login: ${testAccount.user}`)
  console.log(`   Pass:  ${testAccount.pass}`)

  return transporter
}

/**
 * Generate a deterministic QR-like grid SVG from a token string.
 * This isn't a real QR code standard, but it looks like one and is
 * unique per token — sufficient for a demo. In production you'd use
 * a real QR library (qrcode npm package) to generate a proper one.
 */
function generateQRSvg(tokenId, size = 200) {
  const grid = 21 // 21×21 like QR Version 1
  const cell = size / grid
  let rects = ''

  // Seed-based deterministic pattern from token string
  function hash(str, i) {
    let h = 0
    for (let c = 0; c < str.length; c++) {
      h = ((h << 5) - h + str.charCodeAt(c) + i * 7) | 0
    }
    return h
  }

  // Draw finder patterns (the 3 big squares in corners)
  function finderPattern(ox, oy) {
    // Outer 7×7
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isEdge = r === 0 || r === 6 || c === 0 || c === 6
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
        if (isEdge || isInner) {
          rects += `<rect x="${(ox + c) * cell}" y="${(oy + r) * cell}" width="${cell}" height="${cell}" fill="#0a1628"/>`
        }
      }
    }
  }

  finderPattern(0, 0)
  finderPattern(grid - 7, 0)
  finderPattern(0, grid - 7)

  // Fill data area
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // Skip finder pattern areas
      if ((r < 8 && c < 8) || (r < 8 && c >= grid - 8) || (r >= grid - 8 && c < 8)) continue
      const idx = r * grid + c
      if (Math.abs(hash(tokenId, idx)) % 3 === 0) {
        rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#0a1628"/>`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="white" rx="8"/>
    ${rects}
  </svg>`
}

/**
 * Send a gift notification email to the recipient.
 */
async function sendGiftEmail({ recipientEmail, senderName, fareDollars, tokenId, isGuest }) {
  if (!transporter) {
    console.warn('⚠ Mailer not initialized, skipping email')
    return null
  }

  const subject = isGuest
    ? `🚌 ${senderName} sent you a TransitLink guest pass!`
    : `🚌 ${senderName} gifted you a TransitLink fare!`

  const appUrl = `http://localhost:5173`
  const qrSvg = generateQRSvg(tokenId, 180)
  // Base64 encode the SVG for inline embedding
  const qrBase64 = Buffer.from(qrSvg).toString('base64')
  const qrDataUri = `data:image/svg+xml;base64,${qrBase64}`

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1565ff,#0040a0);padding:32px 24px;text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">🚌</div>
        <h1 style="color:white;font-size:22px;margin:0;">TransitLink Winnipeg</h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">You received a fare gift!</p>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
          <strong style="color:white;">${senderName}</strong> sent you
          <strong style="color:#00d68f;">$${fareDollars.toFixed(2)}</strong>
          for a transit ride in Winnipeg.
        </p>
        ${isGuest ? `
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:16px 0;text-align:center;">
            <p style="font-size:14px;color:white;font-weight:600;margin:0 0 16px;">Your Guest Pass QR Code</p>
            <div style="background:white;display:inline-block;padding:12px;border-radius:12px;margin-bottom:16px;">
              <img src="${qrDataUri}" width="180" height="180" alt="QR Code" style="display:block;"/>
            </div>
            <p style="font-size:13px;color:#94a3b8;margin:0 0 8px;">Pass code:</p>
            <div style="font-family:monospace;font-size:15px;color:#ffb800;font-weight:bold;letter-spacing:1px;margin-bottom:16px;background:rgba(255,184,0,0.1);border:1px solid rgba(255,184,0,0.3);border-radius:8px;padding:10px;">${tokenId}</div>
            <div style="text-align:left;font-size:12px;color:#64748b;line-height:1.8;">
              <div>⏱ 90-minute window starts on first tap</div>
              <div>🔒 10-min rescan lock between uses</div>
              <div>📱 Show this QR code to the bus reader to board</div>
            </div>
          </div>
          <a href="${appUrl}" style="display:block;text-align:center;background:#1565ff;color:white;padding:14px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;margin-top:16px;">
            Open TransitLink App →
          </a>
          <p style="font-size:11px;color:#475569;margin:16px 0 0;text-align:center;">
            Can't scan the QR? Open the TransitLink app and enter your pass code manually.
          </p>
        ` : `
          <div style="background:rgba(0,214,143,0.1);border:1px solid rgba(0,214,143,0.3);border-radius:12px;padding:16px;text-align:center;">
            <p style="font-size:14px;color:#00d68f;font-weight:600;margin:0;">
              ✓ $${fareDollars.toFixed(2)} has been added to your balance!
            </p>
          </div>
          <a href="${appUrl}" style="display:block;text-align:center;background:#1565ff;color:white;padding:14px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;margin-top:16px;">
            Open TransitLink →
          </a>
        `}
      </div>
      <div style="padding:16px 24px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
        <p style="font-size:11px;color:#475569;margin:0;">TransitLink Winnipeg — Demo App</p>
      </div>
    </div>
  `

  try {
    const info = await transporter.sendMail({
      from: '"TransitLink Winnipeg" <noreply@transitlink.demo>',
      to: recipientEmail,
      subject,
      html,
    })

    const previewUrl = nodemailer.getTestMessageUrl(info)
    console.log(`📧 Email sent to ${recipientEmail} → Preview: ${previewUrl}`)
    return previewUrl
  } catch (err) {
    console.error('📧 Email send failed:', err.message)
    return null
  }
}

module.exports = { initMailer, sendGiftEmail }
