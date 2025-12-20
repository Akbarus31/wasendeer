import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'
import fs from 'fs'
import mysql from 'mysql2/promise'

// =============================
// DATABASE
// =============================
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'C0b412345@',
  database: 'db_wasender',
  waitForConnections: true,
  connectionLimit: 10
})

let sockGlobal = null
let isLoggingOut = false
let schedulerStarted = false

// =============================
// START BOT
// =============================
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const sock = makeWASocket({ auth: state })
  sockGlobal = sock

  sock.ev.on('creds.update', saveCreds)

  // ===== MESSAGE LISTENER =====
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    if (!msg.key.remoteJid.endsWith('@g.us')) return

    const groupId = msg.key.remoteJid
    const sender = msg.key.participant || 'UNKNOWN'

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!text) return

    // ===== COMMAND HANDOVER =====
    if (text.startsWith('!sethandover')) {
      const newMessage = text.replace('!sethandover', '').trim()

      if (!newMessage) {
        await sock.sendMessage(groupId, {
          text: '❌ Format salah.\nGunakan:\n!sethandover <isi pesan>'
        })
        return
      }

      // ambil metadata grup, fallback ke DB jika gagal
      let groupName = 'UNKNOWN'
      try {
        const metadata = await sock.groupMetadata(groupId)
        groupName = metadata.subject
      } catch {
        console.error('❌ Gagal ambil nama grup, pakai DB')
        const [rows] = await db.execute(
          `SELECT group_name FROM wa_handover_messages WHERE group_id = ? ORDER BY id DESC LIMIT 1`,
          [groupId]
        )
        if (rows.length) groupName = rows[0].group_name
      }

      await db.execute(
        `REPLACE INTO wa_handover_messages
        (group_id, group_name, message, updated_by)
        VALUES (?, ?, ?, ?)`,
        [groupId, groupName, newMessage, sender]
      )

      await sock.sendMessage(groupId, {
        text: `✅ Pesan handover berhasil diperbarui\n✍️ Oleh: ${sender}`
      })

      console.log(`📝 Handover diupdate oleh ${sender}`)
    }
  })

  // ===== CONNECTION UPDATE =====
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📱 Scan QR:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
      startScheduler(sock)
    }

    if (connection === 'close') {
      if (isLoggingOut) return
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔁 reconnecting...')
        start()
      }
    }
  })
}

// =============================
// SCHEDULER KIRIM PESAN
// =============================
function startScheduler(sock) {
  if (schedulerStarted) return
  schedulerStarted = true

  setInterval(async () => {
    try {
      const [rows] = await db.execute(`
        SELECT h.*
        FROM wa_handover_messages h
        INNER JOIN (
            SELECT group_id, MAX(id) AS max_id
            FROM wa_handover_messages
            GROUP BY group_id
        ) latest ON h.group_id = latest.group_id AND h.id = latest.max_id
      `)

      for (const row of rows) {
        const groupName = row.group_name || 'UNKNOWN'
        const groupId = row.group_id
        const messageText = row.message || 'Tidak ada pesan'

        const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

        const finalMessage =
`===== ${groupName} =====
⏰ Reminder Otomatis

${messageText}

────────────────
🤖 Pesan ini dikirim dari bot
🕒 ${waktu} WIB`

        try {
          await sock.sendMessage(groupId, { text: finalMessage })

          await db.execute(
            `INSERT INTO wa_message_logs
             (group_id, group_name, message, status)
             VALUES (?, ?, ?, 'SUCCESS')`,
            [groupId, groupName, finalMessage]
          )

          console.log(`📤 Terkirim ke ${groupName}`)
        } catch (err) {
          await db.execute(
            `INSERT INTO wa_message_logs
             (group_id, group_name, message, status, error_message)
             VALUES (?, ?, ?, 'FAILED', ?)`,
            [groupId, groupName, finalMessage, err.message]
          )

          console.error('❌ Gagal kirim:', err.message)
        }
      }
    } catch (e) {
      console.error('❌ Gagal ambil data handover:', e.message)
    }
  }, 60 * 1000) // tiap 1 menit
}

// =============================
// LOGOUT BERSIH
// =============================
async function logout() {
  if (!sockGlobal) process.exit(0)
  isLoggingOut = true

  try { await sockGlobal.logout() } catch {}
  if (fs.existsSync('./session')) {
    fs.rmSync('./session', { recursive: true, force: true })
  }
  process.exit(0)
}

process.on('SIGINT', logout)
process.on('SIGTERM', logout)

start()
