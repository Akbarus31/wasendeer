# wasender 📲

**wasender** adalah script WhatsApp sender berbasis **Node.js** menggunakan library  
[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys).

Script ini berjalan **tanpa desktop / GUI**, cocok untuk **Linux Server / VM / VPS**,  
dan dapat mengirim **pesan otomatis berulang ke grup WhatsApp**.

---

## ✨ Fitur
- Login WhatsApp via **QR Code**
- Kirim pesan otomatis ke **grup WhatsApp**
- Interval pengiriman (misal tiap 1 menit)
- Session tersimpan (tidak perlu scan QR ulang)
- Auto reconnect
- Bisa dijalankan 24/7 di server

---

## 📦 Kebutuhan Sistem
- OS: Ubuntu / Debian (direkomendasikan)
- Node.js **v20+**
- npm
- Akses internet

---

## 🚀 Cara Install (Otomatis)

Project ini sudah disediakan **script installer (`install.sh`)**  
sehingga tidak perlu install manual satu per satu.

### 1️⃣ Clone / Upload Project
```bash
git clone <repo-ini>
cd wasender

