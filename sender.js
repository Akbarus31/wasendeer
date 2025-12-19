const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const qrcode = require('qrcode-terminal')
const fs = require('fs')

let sockGlobal
let isLoggingOut = false

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')

  const sock = makeWASocket({
    auth: state
  })

  sockGlobal = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📱 Scan QR ini:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
      await showGroups(sock)
      sendMessageToGroup(sock)
    }

    if (connection === 'close') {
      if (isLoggingOut) {
        console.log('🚪 Logout selesai, tidak reconnect')
        return
      }

      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔁 reconnecting...')
        start()
      }
    }
  })
}

// =============================
async function showGroups(sock) {
  const groups = await sock.groupFetchAllParticipating()
  console.log('\n📋 DAFTAR GROUP:')
  for (const id in groups) {
    console.log(`- ${groups[id].subject} => ${id}`)
  }
  console.log('\n')
}

function sendMessageToGroup(sock) {
    const groupId = '120363405576524480@g.us' // test group
    // const groupId = '120363405604161599@g.us' // ID GROUP OCO PERINTIS

  setInterval(async () => {
    try {
      await sock.sendMessage(groupId, {
        text:
            `===== HO PERINTIS =====
        ⏰ Reminder Otomatis

        📌 Mohon update HO hari ini
        📊 Lengkapi data sesuai format
        🙏 Terima kasih`
      })

      console.log('📤 Pesan terkirim')
    } catch (err) {
      console.error('❌ Gagal kirim:', err.message)
    }
  }, 1 * 60 * 1000) // 10 menit
}


// =============================
// LOGOUT BERSIH
// =============================
async function logout() {
  if (!sockGlobal) process.exit(0)

  isLoggingOut = true
  console.log('\n🚪 Logout WhatsApp...')

  try {
    await sockGlobal.logout()
  } catch (e) {}

  // 🔥 WAJIB: hapus session
  if (fs.existsSync('./session')) {
    fs.rmSync('./session', { recursive: true, force: true })
    console.log('🗑️ Session dihapus')
  }

  console.log('✅ Logout bersih selesai')
  process.exit(0)
}

process.on('SIGINT', logout)
process.on('SIGTERM', logout)

start()

