import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'
import fs from 'fs'
import mysql from 'mysql2/promise'

// =============================
// DATABASE CONNECTIONS
// =============================

// DB untuk WA Sender (handover + wa logs)
const dbWASender = mysql.createPool({
  host: '192.168.2.143',
  user: 'botuser',
  password: 'C0b412345@',
  database: 'db_wasender',
  waitForConnections: true,
  connectionLimit: 10
})

// DB untuk Bot Rekaman (tbl_rekaman_log)
const dbBot = mysql.createPool({
  host: '192.168.2.143',
  user: 'botuser',
  password: 'C0b412345@',
  database: 'db_bot',
  waitForConnections: true,
  connectionLimit: 10
})


// =============================
// GLOBAL STATE
// =============================
let sockGlobal = null
let isLoggingOut = false
let schedulerStarted = false
let alertSchedulerStarted = false


// =============================
// START BOT
// =============================
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const sock = makeWASocket({ auth: state })
  sockGlobal = sock

  sock.ev.on('creds.update', saveCreds)

  // =============================
  // MESSAGE LISTENER (GROUP ONLY)
  // =============================
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

    // =============================
    // COMMAND: !sethandover
    // =============================
    if (text.startsWith('!sethandover')) {
      const newMessage = text.replace('!sethandover', '').trim()

      if (!newMessage) {
        await sock.sendMessage(groupId, {
          text: '❌ Format salah.\nGunakan:\n!sethandover <isi pesan>'
        })
        return
      }

      // ambil nama grup
      let groupName = 'UNKNOWN'
      try {
        const metadata = await sock.groupMetadata(groupId)
        groupName = metadata.subject
      } catch {
        const [rows] = await dbWASender.execute(
          `SELECT group_name
           FROM wa_handover_messages
           WHERE group_id = ?
           ORDER BY id DESC LIMIT 1`,
          [groupId]
        )
        if (rows.length) groupName = rows[0].group_name
      }

      // ambil nama pengirim
      let senderName = msg.pushName || sender
      try {
        const meta = await sock.groupMetadata(groupId)
        const p = meta.participants.find(x => x.id === sender)
        if (p?.notify) senderName = p.notify
      } catch {}

      await dbWASender.execute(
        `REPLACE INTO wa_handover_messages
         (group_id, group_name, message, updated_by)
         VALUES (?, ?, ?, ?)`,
        [groupId, groupName, newMessage, senderName]
      )

      await sock.sendMessage(groupId, {
        text: `✅ Pesan handover berhasil diperbarui\n✍️ Oleh: ${senderName}`
      })

      console.log(`📝 Handover diupdate | ${groupName}`)
    }
  })

  // =============================
  // CONNECTION UPDATE
  // =============================
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📱 Scan QR:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
      startRekamanAlertScheduler(sock)
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
// SCHEDULER HANDOVER
// =============================
function startScheduler(sock) {
  if (schedulerStarted) return
  schedulerStarted = true

  setInterval(async () => {
    try {
      const [rows] = await dbWASender.execute(`
        SELECT h.*
        FROM wa_handover_messages h
        INNER JOIN (
          SELECT group_id, MAX(id) AS max_id
          FROM wa_handover_messages
          GROUP BY group_id
        ) x
        ON h.group_id = x.group_id AND h.id = x.max_id
      `)

      for (const row of rows) {
        const waktu = new Date().toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta'
        })

        const finalMessage =
`===== ${row.group_name} =====
⏰ Reminder Otomatis

${row.message}

────────────────
_This message automated send by OCO Automation | ${waktu}_`

        try {
          await sock.sendMessage(row.group_id, { text: finalMessage })

          await dbWASender.execute(
            `INSERT INTO wa_message_logs
             (group_id, group_name, message, status)
             VALUES (?, ?, ?, 'SUCCESS')`,
            [row.group_id, row.group_name, finalMessage]
          )

          console.log(`📤 Reminder terkirim | ${row.group_name}`)
        } catch (err) {
          console.error('❌ Gagal kirim reminder:', err.message)
        }
      }
    } catch (e) {
      console.error('❌ Scheduler handover error:', e.message)
    }
  }, 30 * 60 * 1000) // 30 menit
}


// =============================
// SCHEDULER ALERT
// =============================
function startRekamanAlertScheduler(sock) {
  if (alertSchedulerStarted) return
  alertSchedulerStarted = true

  setInterval(async () => {
    try {
      const [rows] = await dbBot.execute(`
        SELECT *
        FROM tbl_rekaman_log
        WHERE rc <> '00'
        AND alert_sent = 0
        ORDER BY created_at ASC
        LIMIT 5
      `)

      if (!rows.length) return

      for (const log of rows) {
        const waktuLog = new Date(log.created_at).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta'
        })

        const waktuKirim = new Date().toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta'
        })

        const alertMessage =
		`🚨 *ALERT REKAMAN* 🚨

		RC        : ${log.rc}
		Level     : ${log.level}
		Unique ID : ${log.unique_id}
		Source    : ${log.source || '-'}
		Waktu     : ${waktuLog}

		Pesan:
		${log.message}

		────────────────
		_This message automated send by OCO Automation | ${waktuKirim}_`

        const targetJid = '120363405576524480@g.us'

        await sock.sendMessage(targetJid, { text: alertMessage })

        await dbBot.execute(
          `UPDATE tbl_rekaman_log
           SET alert_sent = 1
           WHERE id = ?`,
          [log.id]
        )

        console.log(
          `🚨 Alert terkirim | rc=${log.rc} | log_id=${log.id}`
        )
      }
    } catch (err) {
      console.error('❌ Scheduler alert error:', err.message)
    }
  }, 60 * 1000)
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

// =============================
start()

