const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron');
const moment = require('moment-timezone');
require('dotenv').config();

// Initialize
const app = express();
const prisma = new PrismaClient();
const bot = new TelegramBot(process.env.BOT_TOKEN);

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

// Database Helper Functions
async function findOrCreateUser(telegramUser) {
  try {
    let user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: telegramUser.id,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username
        }
      });
    }

    return user;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
}

async function getTodayTarbiyah(userId) {
  const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
  
  try {
    const record = await prisma.tarbiyahRecord.findUnique({
      where: {
        userId_date: {
          userId: userId,
          date: new Date(today)
        }
      }
    });

    return record;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
}

async function updateTarbiyahPoint(userId, pointKey, value) {
  const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
  
  try {
    const record = await prisma.tarbiyahRecord.upsert({
      where: {
        userId_date: {
          userId: userId,
          date: new Date(today)
        }
      },
      create: {
        userId: userId,
        date: new Date(today),
        [pointKey]: value
      },
      update: {
        [pointKey]: value
      }
    });

    return record;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
}

// Bot Command Handlers
bot.onText(/\/start/, async (msg) => {
  // Only respond to private chats
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
  const todayRecord = await getTodayTarbiyah(user.id);

  // Send header
  const headerMessage = `📋 <b>Catat Tarbiyah - ${today}</b>\n👤 <b>Nama:</b> ${user.displayName}\n\nSilakan klik untuk setiap aktivitas tarbiyah:`;
  bot.sendMessage(msg.chat.id, headerMessage, { parse_mode: 'HTML' });

  // Send each tarbiyah point as separate message with inline keyboard
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
    
    bot.sendMessage(msg.chat.id, message, {
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
  const todayRecord = await getTodayTarbiyah(user.id);

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

  const user = await findOrCreateUser(msg.from);
  if (!user) {
    return bot.sendMessage(msg.chat.id, '❌ Terjadi error. Silakan coba lagi.');
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: name }
    });

    const responseText = `✅ Nama berhasil disimpan: <b>${name}</b>\n\n` +
                        `Sekarang Anda bisa menggunakan:\n` +
                        `• /catat - untuk mencatat tarbiyah\n` +
                        `• /status - untuk melihat status tarbiyah`;

    bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Gagal menyimpan nama. Silakan coba lagi.');
  }
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (query) => {
  const data = query.data;
  const user = await findOrCreateUser(query.from);

  if (!user) {
    return bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
  }

  if (data.startsWith('tarbiyah_')) {
    const parts = data.split('_');
    if (parts.length >= 3) {
      const action = parts[parts.length - 1]; // 'done' or 'undone'
      const pointKey = parts.slice(1, -1).join('_'); // get pointKey
      
      const value = action === 'done';
      const point = TARBIYAH_POINTS.find(p => p.key === pointKey);
      
      if (point) {
        const success = await updateTarbiyahPoint(user.id, pointKey, value);
        
        if (success) {
          const index = TARBIYAH_POINTS.findIndex(p => p.key === pointKey);
          const status = value ? '✅ Sudah' : '❌ Belum';
          const message = `${index + 1}. <b>${point.label}</b>\nStatus: ${status}\n\n✅ <i>Tersimpan! Gunakan /catat untuk mengedit.</i>`;
          
          // Edit message to remove keyboard
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

// Admin command: daily report
bot.onText(/\/dailyreport/, async (msg) => {
  if (msg.from.id !== ADMIN_USER_ID) return;
  
  await sendDailyReport();
  bot.sendMessage(msg.chat.id, '📊 Daily report berhasil dikirim ke grup.');
});

// Daily Report Function
async function sendDailyReport() {
  try {
    const today = moment().tz('Asia/Jakarta');
    const todayStr = today.format('YYYY-MM-DD');
    const formattedDate = today.format('dddd, D MMMM YYYY');
    
    // Get all today's records with user info
    const records = await prisma.tarbiyahRecord.findMany({
      where: {
        date: new Date(todayStr)
      },
      include: {
        user: true
      }
    });

    if (records.length === 0) {
      console.log('No tarbiyah data found for daily report');
      return;
    }

    let allReports = `📊 <b>LAPORAN HARIAN TARBIYAH</b>\n${formattedDate}\n\n`;

    records.forEach(record => {
      const user = record.user;
      let completedCount = 0;
      let notCompletedCount = 0;

      let reportMessage = `${user.displayName || user.firstName}\n=====================\n`;

      TARBIYAH_POINTS.forEach((point, index) => {
        const value = record[point.key];
        const status = value ? '✅' : '❌';
        const pointNumber = index + 1;

        reportMessage += `${pointNumber}. ${point.reportLabel} : ${status}\n`;

        if (value) {
          completedCount++;
        } else {
          notCompletedCount++;
        }
      });

      // Calculate qisos and bonus
      const qisosAmount = notCompletedCount * 5000;
      const bonusAmount = completedCount * 1000;

      const formatRupiah = (amount) => {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      };

      reportMessage += `================\n`;
      reportMessage += `Qisos perhari Rp ${formatRupiah(qisosAmount)}\n`;
      reportMessage += `Bonus perhari Rp ${formatRupiah(bonusAmount)}\n\n`;

      allReports += reportMessage;
    });

    // Send to group
    await bot.sendMessage(GROUP_CHAT_ID, allReports, {
      parse_mode: 'HTML',
      message_thread_id: MESSAGE_THREAD_ID
    });

    console.log(`Daily report sent for ${records.length} users - ${todayStr}`);
  } catch (error) {
    console.error('Error sending daily report:', error);
  }
}

// Schedule daily report for 23:00 WIB
cron.schedule('0 23 * * *', () => {
  console.log('Sending scheduled daily report...');
  sendDailyReport();
}, {
  timezone: "Asia/Jakarta"
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Tarbiyah Bot running on port ${PORT}`);
  console.log(`🎯 Webhook URL: https://your-app-name.onrender.com/webhook`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
