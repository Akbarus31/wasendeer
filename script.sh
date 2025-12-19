#!/bin/bash

set -e

echo "🚀 Mulai setup WhatsApp Sender (Baileys)"
echo "======================================"

# =========================
# CEK ROOT
# =========================
if [ "$EUID" -ne 0 ]; then
  echo "❌ Jalankan script sebagai root (sudo)"
  exit 1
fi

# =========================
# UPDATE SYSTEM
# =========================
echo "🔄 Update system..."
apt update -y
apt install -y curl git build-essential

# =========================
# INSTALL NODEJS 20
# =========================
if ! command -v node >/dev/null 2>&1; then
  echo "📦 Install Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  echo "✅ Node.js sudah terinstall"
fi

echo "📌 Node version:"
node -v
npm -v

# =========================
# INSTALL DEPENDENCY PROJECT
# =========================
if [ -f "package.json" ]; then
  echo "📦 Install npm dependencies..."
  npm install
else
  echo "❌ package.json tidak ditemukan!"
  exit 1
fi

# =========================
# SELESAI
# =========================
echo ""
echo "✅ INSTALL SELESAI"
echo "=============================="
echo "▶ Jalankan dengan:"
echo "   node sender.js"
echo ""
echo "📱 Jika belum login, QR akan muncul"
echo "=============================="

