const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const moment = require('moment-timezone');
require('dotenv').config();

// Initialize
const app = express();
const bot = new TelegramBot(process.env.BOT_TOKEN);

// Data file paths
const DATA_DIR = './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TARBIYAH_FILE = path.join(DATA_DIR, 'tarbiyah.json');

// Middleware
app.use(express.json());

// Constants
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const MESSAGE_THREAD_ID = process.env.MESSAGE_THREAD_ID;

// Tarbiyah Points Configuration
const TARBIYAH_POINTS = [
  { key: 'tahajud', label: 'Tahajjud', reportLabel: 'Tahajjud' },
  { key: 'qobliyahSubuh', label: 'Qobliyah Subuh', reportLabel: 'Qobliyah Subuh' },
  { key: 'subuh', label: 'Sholat Subuh', reportLabel: 'Subuh Berjamaah Di Masjid Tepat Waktu' },
  { key: 'dhuha', label: 'Sholat Dhuha', reportLabel: 'Dhuha' },
  { key: 'qobliyahDzuhur', label: 'Qobliyah Dzuhur', reportLabel: 'Qobliyah Zuhur' },
  { key: 'dzuhur', label: 'Sholat Dzuhur', reportLabel: 'Zuhur Berjamaah Di Masjid Tepat Waktu' },
  { key: 'badiahDzuhur', label: "Ba'diah Dzuhur", reportLabel: "Ba'diah Zuhur" },
  { key: 'qobliyahAshar', label: 'Qobliyah Ashar', reportLabel: 'Qobliah Ashar' },
  { key: 'ashar', label: 'Sholat Ashar', reportLabel: 'Ashar Berjamaah di Masjid Tepat Waktu' },
  { key: 'maghrib', label: 'Sholat Maghrib', reportLabel: 'Maghrib Berjamaah di Masjid Tepat Waktu' },
  { key: 'badiahMaghrib', label: "Ba'diah Maghrib", reportLabel: "Ba'diah Maghrib" },
  { key: 'qobliyahIsya', label: 'Qobliyah Isya', reportLabel: 'Qobliyah Isya' },
  { key: 'isya', label: 'Sholat Isya', reportLabel: 'Isya Berjamaah di Masjid Tepat Waktu' },
  { key: 'badiahIsya', label: "Ba'diah Isya", reportLabel: "Ba'diah Isya" },
  { key: 'odoj', label: 'ODOJ', reportLabel: 'ODOJ' },
  { key: 'nafs', label: 'NAFS', reportLabel: 'NAFS' },
  { key: 'bacaArtiQuran', label: 'Baca Arti Quran', reportLabel: 'Baca arti quran 1 lembar' },
  { key: 'infaqSubuh', label: 'Infaq Subuh', reportLabel: 'Infaq Subuh' },
  { key: 'istighfar', label: 'Istighfar 100x', reportLabel: 'Istighfar 100x' },
  { key: 'sholawat', label: 'Sholawat 100x', reportLabel: 'Sholawat 100x' },
  { key: 'buzzer', label: 'Buzzer', reportLabel: 'Buzzer PD' }
];

// File system helpers
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

async function readJsonFile(filePath, defaultValue = {}) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default value
      await writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    console.error(`Error reading ${filePath}:`, error);
    return defaultValue;
  }
}

async function writeJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

// Data access functions
async function findOrCreateUser(telegramUser) {
  try {
    const users = await readJsonFile(USERS_FILE, {});
    const userId = telegramUser.id.toString();

    if (!users[userId]) {
      users[userId] = {
        telegramId: telegramUser.id,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        displayName: null,
        createdAt: new Date().toISOString()
      };
      await writeJsonFile(USERS_FILE, users);
    }

    return users[userId];
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    return null;
  }
}

async function updateUserName(telegramId, displayName) {
  try {
    const users = await readJsonFile(USERS_FILE, {});
    const userId = telegramId.toString();
    
    if (users[userId]) {
      users[userId].displayName = displayName;
      await writeJsonFile(USERS_FILE, users);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating user name:', error);
    return false;
  }
}

async function getTodayTarbiyah(telegramId) {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    const tarbiyahData = await readJsonFile(TARBIYAH_FILE, {});
    const userId = telegramId.toString();
    
    return tarbiyahData[userId] && tarbiyahData[userId][today] 
      ? tarbiyahData[userId][today] 
      : null;
  } catch (error) {
    console.error('Error getting today tarbiyah:', error);
    return null;
  }
}

async function updateTarbiyahPoint(telegramId, pointKey, value) {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    const tarbiyahData = await readJsonFile(TARBIYAH_FILE, {});
    const userId = telegramId.toString();
    
    if (!tarbiyahData[userId]) {
      tarbiyahData[userId] = {};
    }
    
    if (!tarbiyahData[userId][today]) {
      tarbiyahData[userId][today] = {};
    }
    
    tarbiyahData[userId][today][pointKey] = value;
    tarbiyahData[userId][today].updatedAt = new Date().toISOString();
    
    await writeJsonFile(TARBIYAH_FILE, tarbiyahData);
    return true;
  } catch (error) {
    console.error('Error updating tarbiyah point:', error);
    return false;
  }
}

// Bot Command Handlers
bot.onText(/\/start/, async (msg) => {
  if (msg.chat.type !== 'private') return;

  const user = await findOrCreateUser(msg.from);
  if (!user) {
    return bot.sendMessage(msg.chat.id, '❌ Terjadi error. Silakan coba lagi.');
  }

  let responseText;
  
  if (user.displayName) {
    responseText = `Assalamu'alaikum ${user.displayName}! 👋\n\n` +
                  `🤖 <b>Bot Tarbiyah</b>\n` +
                  `Bot ini membantu Anda mencatat aktivitas tarbiyah harian.\n\n` +
                  `📋 <b>Command tersedia:</b>\n` +
                  `• /catat - Catat tarbiyah hari ini\n` +
                  `• /status - Lihat status tarbiyah hari ini\n\n` +
                  `💡 <b>Tips:</b> Gunakan /catat setiap hari untuk mencatat aktivitas tarbiyah Anda!`;
  } else {
    responseText = `Assalamu'alaikum! 👋\n\n` +
                  `🤖 <b>Selamat datang di Bot Tarbiyah</b>\n` +
                  `Bot ini membantu Anda mencatat aktivitas tarbiyah harian.\n\n` +
                  `📝 <b>Langkah pertama:</b>\n` +
                  `Silakan set nama Anda dengan format:\n` +
                  `<b>Nama: [nama anda]</b>\n\n` +
                  `Contoh: <b>Nama: Ahmad</b>\n\n` +
                  `📋 <b>Command tersedia:</b>\n` +
                  `• /catat - Catat tarbiyah hari ini\n` +
                  `• /status - Lihat status tarbiyah hari ini`;
  }

  bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'HTML' });
});

bot.onText(/\/catat/, async (msg) => {
  if (msg.chat.type !== 'private') return;

  const user = await findOrCreateUser(msg.from);
  if (!user || !user.displayName) {
    return bot.sendMessage(msg.chat.id, 
      'Silakan set nama Anda terlebih dahulu dengan mengetik: <b>Nama: [nama anda]</b>\n\nContoh: <b>Nama: Ahmad</b>',
      { parse_mode: 'HTML' }
    );
  }

  const today = moment().tz('Asia/Jakarta').format('DD/MM/YYYY');
  const todayRecord = await getTodayTarbiyah(msg.from.id);

  // Send header
  const headerMessage = `📋 <b>Catat Tarbiyah - ${today}</b>\n👤 <b>Nama:</b> ${user.displayName}\n\nSilakan klik untuk setiap aktivitas tarbiyah:`;
  bot.sendMessage(msg.chat.id, headerMessage, { parse_mode: 'HTML' });

  // Send each tarbiyah point as separate message
  for (let i = 0; i < TARBIYAH_POINTS.length; i++) {
    const point = TARBIYAH_POINTS[i];
    const currentValue = todayRecord ? todayRecord[point.key] : false;
    const status = currentValue ? '✅ Sudah' : '⚪ Belum dipilih';

    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Sudah', callback_data: `tarbiyah_${point.key}_done` },
        { text: '❌ Belum', callback_data: `tarbiyah_${point.key}_undone` }
      ]]
    };

    const message = `${i + 1}. <b>${point.label}</b>\nStatus: ${status}`;
    
    await bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
});

bot.onText(/\/status/, async (msg) => {
  if (msg.chat.type !== 'private') return;

  const user = await findOrCreateUser(msg.from);
  if (!user || !user.displayName) {
    return bot.sendMessage(msg.chat.id, 
      'Silakan set nama Anda terlebih dahulu dengan mengetik: <b>Nama: [nama anda]</b>',
      { parse_mode: 'HTML' }
    );
  }

  const today = moment().tz('Asia/Jakarta').format('DD/MM/YYYY');
  const todayRecord = await getTodayTarbiyah(msg.from.id);

  let message = `📊 <b>Status Tarbiyah - ${today}</b>\n👤 <b>Nama:</b> ${user.displayName}\n\n`;

  if (todayRecord) {
    let completedCount = 0;
    
    TARBIYAH_POINTS.forEach(point => {
      const status = todayRecord[point.key] ? '✅' : '❌';
      message += `${status} ${point.label}\n`;
      if (todayRecord[point.key]) completedCount++;
    });

    const percentage = Math.round((completedCount / TARBIYAH_POINTS.length) * 100);
    message += `\n📈 <b>Progress:</b> ${completedCount}/${TARBIYAH_POINTS.length} (${percentage}%)`;
  } else {
    message += 'Belum ada data tarbiyah untuk hari ini.\nGunakan /catat untuk mulai mencatat.';
  }

  bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
});

// Handle name setting
bot.onText(/^nama:\s*(.+)$/i, async (msg, match) => {
  if (msg.chat.type !== 'private') return;

  const name = match[1].trim();
  if (!name) {
    return bot.sendMessage(msg.chat.id, 
      'Format nama tidak valid. Gunakan format:\n<b>Nama: [nama anda]</b>',
      { parse_mode: 'HTML' }
    );
  }

  const success = await updateUserName(msg.from.id, name);
  
  if (success) {
    const responseText = `✅ Nama berhasil disimpan: <b>${name}</b>\n\n` +
                        `Sekarang Anda bisa menggunakan:\n` +
                        `• /catat - untuk mencatat tarbiyah\n` +
                        `• /status - untuk melihat status tarbiyah`;

    bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(msg.chat.id, '❌ Gagal menyimpan nama. Silakan coba lagi.');
  }
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  const data = query.data;

  if (data.startsWith('tarbiyah_')) {
    const parts = data.split('_');
    if (parts.length >= 3) {
      const action = parts[parts.length - 1];
      const pointKey = parts.slice(1, -1).join('_');
      
      const value = action === 'done';
      const point = TARBIYAH_POINTS.find(p => p.key === pointKey);
      
      if (point) {
        const success = await updateTarbiyahPoint(query.from.id, pointKey, value);
        
        if (success) {
          const index = TARBIYAH_POINTS.findIndex(p => p.key === pointKey);
          const status = value ? '✅ Sudah' : '❌ Belum';
          const message = `${index + 1}. <b>${point.label}</b>\nStatus: ${status}\n\n✅ <i>Tersimpan! Gunakan /catat untuk mengedit.</i>`;
          
          bot.editMessageText(message, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          });
          
          bot.answerCallbackQuery(query.id, { text: 'Tersimpan!' });
        } else {
          bot.answerCallbackQuery(query.id, { text: 'Error menyimpan data' });
        }
      }
    }
  }
});

// Daily Report Function
async function sendDailyReport() {
  try {
    const today = moment().tz('Asia/Jakarta');
    const todayStr = today.format('YYYY-MM-DD');
    const formattedDate = today.format('dddd, D MMMM YYYY');
    
    const users = await readJsonFile(USERS_FILE, {});
    const tarbiyahData = await readJsonFile(TARBIYAH_FILE, {});
    
    let allReports = `📊 <b>LAPORAN HARIAN TARBIYAH</b>\n${formattedDate}\n\n`;
    let reportCount = 0;

    for (const [userId, user] of Object.entries(users)) {
      if (tarbiyahData[userId] && tarbiyahData[userId][todayStr]) {
        const record = tarbiyahData[userId][todayStr];
        let completedCount = 0;
        let notCompletedCount = 0;

        let reportMessage = `${user.displayName || user.firstName}\n=====================\n`;

        TARBIYAH_POINTS.forEach((point, index) => {
          const value = record[point.key] || false;
          const status = value ? '✅' : '❌';
          const pointNumber = index + 1;

          reportMessage += `${pointNumber}. ${point.reportLabel} : ${status}\n`;

          if (value) {
            completedCount++;
          } else {
            notCompletedCount++;
          }
        });

        const qisosAmount = notCompletedCount * 5000;
        const bonusAmount = completedCount * 1000;
        const formatRupiah = (amount) => amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

        reportMessage += `================\n`;
        reportMessage += `Qisos perhari Rp ${formatRupiah(qisosAmount)}\n`;
        reportMessage += `Bonus perhari Rp ${formatRupiah(bonusAmount)}\n\n`;

        allReports += reportMessage;
        reportCount++;
      }
    }

    if (reportCount > 0) {
      await bot.sendMessage(GROUP_CHAT_ID, allReports, {
        parse_mode: 'HTML',
        message_thread_id: MESSAGE_THREAD_ID
      });
      console.log(`Daily report sent for ${reportCount} users - ${todayStr}`);
    }
  } catch (error) {
    console.error('Error sending daily report:', error);
  }
}

// Admin command
bot.onText(/\/dailyreport/, async (msg) => {
  if (msg.from.id !== ADMIN_USER_ID) return;
  
  await sendDailyReport();
  bot.sendMessage(msg.chat.id, '📊 Daily report berhasil dikirim ke grup.');
});

// Schedule daily report
cron.schedule('0 23 * * *', () => {
  console.log('Sending scheduled daily report...');
  sendDailyReport();
}, { timezone: "Asia/Jakarta" });

// Webhook endpoint
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize and start
async function start() {
  await ensureDataDir();
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log(`🚀 Tarbiyah Bot running on port ${PORT}`);
    console.log(`💾 Using JSON file storage (100% FREE!)`);
  });
}

start();
