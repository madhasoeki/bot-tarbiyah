const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');
const cron = require('node-cron');
const moment = require('moment-timezone');
require('dotenv').config();

// Initialize
const app = express();
const bot = new TelegramBot(process.env.BOT_TOKEN);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 3, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Middleware
app.use(express.json());

// Constants
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID);
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const MESSAGE_THREAD_ID = process.env.MESSAGE_THREAD_ID;

// Tarbiyah Points Configuration
const TARBIYAH_POINTS_NORMAL = [
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

// Tarbiyah Points untuk mode haid
const TARBIYAH_POINTS_HAID = [
  { key: 'nafs', label: 'NAFS', reportLabel: 'NAFS' },
  { key: 'alMulk', label: 'Al-mulk', reportLabel: 'Al-mulk' },
  { key: 'infaqSubuh', label: 'Infaq Subuh', reportLabel: 'Infaq Subuh' },
  { key: 'istighfar', label: 'Istighfar 500x', reportLabel: 'Istighfar 500x' },
  { key: 'sholawat', label: 'Sholawat 300x', reportLabel: 'Sholawat 300x' },
  { key: 'bacaBuku', label: 'Baca Buku 5 Halaman', reportLabel: 'Baca Buku 5 Halaman' },
  { key: 'bacaArtiQuran', label: 'Baca arti Qur\'an 5 Lembar', reportLabel: 'Baca arti Qur\'an 5 Lembar' },
  { key: 'jurnalSyukur', label: 'Jurnal Syukur (5)', reportLabel: 'Jurnal Syukur (5)' },
  { key: 'alMasurat', label: 'Al-ma\'surat pagi', reportLabel: 'Al-ma\'surat pagi' },
  { key: 'alMasuratPetang', label: 'Al-ma\'surat petang', reportLabel: 'Al-ma\'surat petang' },
  { key: 'buzzer', label: 'Buzzer', reportLabel: 'Buzzer' }
];

// Database initialization
async function initDatabase() {
  let client;
  try {
    console.log('🔄 Initializing database...');
    
    // Test connection first
    client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        display_name VARCHAR(255),
        is_team_handler BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ready');

    // Create tarbiyah records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tarbiyah_records (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT REFERENCES users(telegram_id),
        record_date DATE,
        point_key VARCHAR(100),
        status VARCHAR(20), -- 'done', 'undone', 'udzhur'
        udzhur_reason TEXT,
        mode VARCHAR(20) DEFAULT 'normal', -- 'normal' or 'haid'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(telegram_id, record_date, point_key)
      )
    `);
    console.log('✅ Tarbiyah records table ready');

    // Add mode column if it doesn't exist (for backward compatibility)
    try {
      await client.query(`
        ALTER TABLE tarbiyah_records ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'normal'
      `);
      console.log('✅ Mode column added to tarbiyah_records table');
    } catch (error) {
      // Column might already exist, that's ok
      console.log('⚠️ Mode column might already exist:', error.message);
    }

    // Create udzhur state table
    await client.query(`
      CREATE TABLE IF NOT EXISTS udzhur_states (
        telegram_id BIGINT PRIMARY KEY,
        point_key VARCHAR(100),
        mode VARCHAR(20),
        point_label VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Create user daily modes table (for tracking daily mode)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_daily_modes (
        telegram_id BIGINT,
        record_date DATE,
        mode VARCHAR(20) DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (telegram_id, record_date)
      )
    `);
    console.log('✅ User daily modes table ready');
    console.log('✅ Udzhur states table ready');

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    console.error('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Database helper functions
async function findOrCreateUser(telegramUser) {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramUser.id]
    );

    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO users (telegram_id, first_name, last_name, username, display_name, is_team_handler) 
         VALUES ($1, $2, $3, $4, NULL, FALSE) 
         RETURNING *`,
        [telegramUser.id, telegramUser.first_name, telegramUser.last_name, telegramUser.username]
      );
      return insertResult.rows[0];
    }

    return userResult.rows[0];
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    return null;
  }
}

async function updateUserName(telegramId, displayName) {
  try {
    const result = await pool.query(
      'UPDATE users SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2',
      [displayName, telegramId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error updating user name:', error);
    return false;
  }
}

async function updateUserTeamHandler(telegramId, isTeamHandler) {
  try {
    const result = await pool.query(
      'UPDATE users SET is_team_handler = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2',
      [isTeamHandler, telegramId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error updating user team handler status:', error);
    return false;
  }
}

async function getTodayTarbiyah(telegramId) {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    
    // Get user's mode for today
    const userMode = await getUserDailyMode(telegramId);
    
    // Get tarbiyah records
    const result = await pool.query(
      'SELECT point_key, status, udzhur_reason FROM tarbiyah_records WHERE telegram_id = $1 AND record_date = $2',
      [telegramId, today]
    );

    const todayRecord = {};
    
    result.rows.forEach(row => {
      if (row.status === 'udzhur') {
        todayRecord[row.point_key] = {
          status: 'udzhur',
          reason: row.udzhur_reason
        };
      } else {
        todayRecord[row.point_key] = row.status === 'done';
      }
    });

    const hasData = Object.keys(todayRecord).length > 0;
    return hasData ? { record: todayRecord, mode: userMode } : { record: null, mode: userMode };
  } catch (error) {
    console.error('Error getting today tarbiyah:', error);
    return { record: null, mode: 'normal' };
  }
}

async function updateTarbiyahPoint(telegramId, pointKey, value, udzhurReason = null, mode = 'normal') {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    
    let status, reason;
    if (udzhurReason) {
      status = 'udzhur';
      reason = udzhurReason;
    } else {
      status = value ? 'done' : 'undone';
      reason = null;
    }

    await pool.query(
      `INSERT INTO tarbiyah_records (telegram_id, record_date, point_key, status, udzhur_reason, mode, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (telegram_id, record_date, point_key)
       DO UPDATE SET status = EXCLUDED.status, udzhur_reason = EXCLUDED.udzhur_reason, mode = EXCLUDED.mode, updated_at = CURRENT_TIMESTAMP`,
      [telegramId, today, pointKey, status, reason, mode]
    );

    return true;
  } catch (error) {
    console.error('Error updating tarbiyah point:', error);
    return false;
  }
}

// User daily mode management
async function setUserDailyMode(telegramId, mode) {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    await pool.query(
      `INSERT INTO user_daily_modes (telegram_id, record_date, mode, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (telegram_id, record_date)
       DO UPDATE SET mode = EXCLUDED.mode, updated_at = CURRENT_TIMESTAMP`,
      [telegramId, today, mode]
    );
    return true;
  } catch (error) {
    console.error('Error setting user daily mode:', error);
    return false;
  }
}

async function getUserDailyMode(telegramId) {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    const result = await pool.query(
      'SELECT mode FROM user_daily_modes WHERE telegram_id = $1 AND record_date = $2',
      [telegramId, today]
    );
    return result.rows.length > 0 ? result.rows[0].mode : 'normal';
  } catch (error) {
    console.error('Error getting user daily mode:', error);
    return 'normal';
  }
}

async function clearUserDailyData(telegramId, newMode) {
  try {
    const today = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    
    // Delete all tarbiyah records for today (since we're switching modes)
    await pool.query(
      'DELETE FROM tarbiyah_records WHERE telegram_id = $1 AND record_date = $2',
      [telegramId, today]
    );
    
    // Set new mode
    await setUserDailyMode(telegramId, newMode);
    
    return true;
  } catch (error) {
    console.error('Error clearing user daily data:', error);
    return false;
  }
}

// Udzhur state management
async function setUdzhurState(telegramId, pointKey, mode, pointLabel) {
  try {
    await pool.query(
      `INSERT INTO udzhur_states (telegram_id, point_key, mode, point_label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_id)
       DO UPDATE SET point_key = EXCLUDED.point_key, mode = EXCLUDED.mode, point_label = EXCLUDED.point_label, created_at = CURRENT_TIMESTAMP`,
      [telegramId, pointKey, mode, pointLabel]
    );
    return true;
  } catch (error) {
    console.error('Error setting udzhur state:', error);
    return false;
  }
}

async function getUdzhurState(telegramId) {
  try {
    const result = await pool.query(
      'SELECT * FROM udzhur_states WHERE telegram_id = $1',
      [telegramId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error getting udzhur state:', error);
    return null;
  }
}

async function clearUdzhurState(telegramId) {
  try {
    await pool.query('DELETE FROM udzhur_states WHERE telegram_id = $1', [telegramId]);
    return true;
  } catch (error) {
    console.error('Error clearing udzhur state:', error);
    return false;
  }
}

// Helper function to get tarbiyah points based on user type and mode
function getTarbiyahPoints(isTeamHandler, isHaidMode = false) {
  let points = isHaidMode ? [...TARBIYAH_POINTS_HAID] : [...TARBIYAH_POINTS_NORMAL];
  
  // Add Hisab Ibadah Tim point for team handlers
  if (isTeamHandler && !isHaidMode) {
    points.push({ key: 'hisabIbadahTim', label: 'Hisab Ibadah Tim', reportLabel: 'Hisab Ibadah Tim' });
  } else if (isTeamHandler && isHaidMode) {
    // Insert Hisab Ibadah Tim before Buzzer for haid mode
    const buzzerIndex = points.findIndex(p => p.key === 'buzzer');
    points.splice(buzzerIndex, 0, { key: 'hisabIbadahTim', label: 'Hisab Ibadah Tim', reportLabel: 'Hisab Ibadah Tim' });
  }
  
  return points;
}

// Helper function to get tarbiyah status display
function getTarbiyahStatus(record, pointKey) {
  if (!record || !record[pointKey]) {
    return { text: '⚪ Belum dipilih', emoji: '❌', isCompleted: false };
  }
  
  const value = record[pointKey];
  
  if (typeof value === 'object' && value.status === 'udzhur') {
    return { 
      text: `🔄 Udzhur (${value.reason})`, 
      emoji: '🔄', 
      isCompleted: true, // Udzhur counts as completed
      reason: value.reason 
    };
  } else if (value === true) {
    return { text: '✅ Sudah', emoji: '✅', isCompleted: true };
  } else {
    return { text: '❌ Belum', emoji: '❌', isCompleted: false };
  }
}

// Bot Command Handlers
bot.onText(/\/start/, async (msg) => {
  if (msg.chat.type !== 'private') return;

  // Check if database is available
  if (!process.env.DATABASE_URL) {
    return bot.sendMessage(msg.chat.id, 
      '⚠️ <b>Bot sedang dalam mode maintenance</b>\n\n' +
      'Database sedang dikonfigurasi. Bot akan kembali normal dalam beberapa menit.\n\n' +
      'Silakan coba lagi nanti. Terima kasih!',
      { parse_mode: 'HTML' }
    );
  }

  const user = await findOrCreateUser(msg.from);
  if (!user) {
    return bot.sendMessage(msg.chat.id, '❌ Terjadi error. Silakan coba lagi.');
  }

  let responseText;
  
  if (user.display_name && user.is_team_handler !== null) {
    // User sudah terdaftar lengkap
    const teamStatus = user.is_team_handler ? 'Handle Tim' : 'Tidak Handle Tim';
    responseText = `Assalamu'alaikum ${user.display_name}! 👋\n\n` +
                  `🤖 <b>Bot Tarbiyah</b>\n` +
                  `👤 <b>Status:</b> ${teamStatus}\n\n` +
                  `Bot ini membantu Anda mencatat aktivitas tarbiyah harian.\n\n` +
                  `📋 <b>Command tersedia:</b>\n` +
                  `• /catat - Catat tarbiyah hari ini\n` +
                  `• /catat haid - Catat tarbiyah mode haid (untuk perempuan)\n` +
                  `• /status - Lihat status tarbiyah hari ini\n` +
                  `• /settim - Ubah status handle tim\n\n` +
                  `💡 <b>Tips:</b> Gunakan /catat setiap hari untuk mencatat aktivitas tarbiyah Anda!`;
  } else if (user.display_name && user.is_team_handler === null) {
    // User sudah ada nama tapi belum konfirmasi handle tim
    responseText = `Assalamu'alaikum ${user.display_name}! 👋\n\n` +
                  `🤖 <b>Bot Tarbiyah</b>\n\n` +
                  `📝 <b>Langkah terakhir:</b>\n` +
                  `Apakah Anda handle tim (koordinator)?`;
    
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Ya, saya handle tim', callback_data: 'setup_team_yes' },
        { text: '❌ Tidak handle tim', callback_data: 'setup_team_no' }
      ]]
    };

    return bot.sendMessage(msg.chat.id, responseText, { 
      parse_mode: 'HTML',
      reply_markup: keyboard 
    });
  } else {
    // User baru, belum ada nama
    responseText = `Assalamu'alaikum! 👋\n\n` +
                  `🤖 <b>Selamat datang di Bot Tarbiyah</b>\n` +
                  `Bot ini membantu Anda mencatat aktivitas tarbiyah harian.\n\n` +
                  `📝 <b>Langkah pertama:</b>\n` +
                  `Silakan set nama Anda dengan format:\n` +
                  `<b>Nama: [nama anda]</b>\n\n` +
                  `Contoh: <b>Nama: Ahmad</b>`;
  }

  bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'HTML' });
});

bot.onText(/\/catat($|\s+(.+))/, async (msg, match) => {
  if (msg.chat.type !== 'private') return;

  // Check if database is available
  if (!process.env.DATABASE_URL) {
    return bot.sendMessage(msg.chat.id, 
      '⚠️ <b>Bot sedang dalam mode maintenance</b>\n\n' +
      'Database sedang dikonfigurasi. Silakan coba lagi nanti.',
      { parse_mode: 'HTML' }
    );
  }

  const user = await findOrCreateUser(msg.from);
  if (!user || !user.display_name) {
    let message = 'Silakan lengkapi registrasi Anda terlebih dahulu:\n\n';
    
    if (!user.display_name) {
      message += '1. Set nama dengan: <b>Nama: [nama anda]</b>\n';
    }

    return bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
  }

  // Check if this is haid mode
  const parameter = match[2] ? match[2].trim().toLowerCase() : '';
  const requestedMode = parameter === 'haid' ? 'haid' : 'normal';
  
  // Get current user mode for today
  const currentMode = await getUserDailyMode(msg.from.id);
  
  // Check if user is switching modes
  if (currentMode !== requestedMode) {
    // Get existing data to check if there are conflicts
    const todayData = await getTodayTarbiyah(msg.from.id);
    const hasExistingData = todayData && todayData.record && Object.keys(todayData.record).length > 0;
    
    if (hasExistingData) {
      // User has existing data but wants to switch mode - ask for confirmation
      const currentModeText = currentMode === 'haid' ? 'Mode Haid' : 'Mode Normal';
      const newModeText = requestedMode === 'haid' ? 'Mode Haid' : 'Mode Normal';
      
      const confirmMessage = `⚠️ <b>Konfirmasi Ganti Mode</b>\n\n` +
                           `Mode saat ini: <b>${currentModeText}</b>\n` +
                           `Mode yang diminta: <b>${newModeText}</b>\n\n` +
                           `❗ Anda sudah memiliki data tarbiyah hari ini dengan ${currentModeText}.\n\n` +
                           `Jika Anda melanjutkan ke ${newModeText}, semua data tarbiyah hari ini akan dihapus dan dimulai dari awal.\n\n` +
                           `Apakah Anda yakin ingin mengganti mode?`;
      
      const keyboard = {
        inline_keyboard: [[
          { text: '✅ Ya, Ganti Mode', callback_data: `change_mode_${requestedMode}_confirm` },
          { text: '❌ Batal', callback_data: 'change_mode_cancel' }
        ]]
      };

      return bot.sendMessage(msg.chat.id, confirmMessage, { 
        parse_mode: 'HTML',
        reply_markup: keyboard 
      });
    } else {
      // No existing data, just set the new mode
      await setUserDailyMode(msg.from.id, requestedMode);
    }
  }
  
  const today = moment().tz('Asia/Jakarta').format('DD/MM/YYYY');
  const todayData = await getTodayTarbiyah(msg.from.id);
  
  // Get appropriate tarbiyah points
  const tarbiyahPoints = getTarbiyahPoints(user.is_team_handler || false, requestedMode === 'haid');

  // Send header
  const modeText = requestedMode === 'haid' ? ' (Mode Haid)' : '';
  const teamText = user.is_team_handler ? ' - Handle Tim' : '';
  const headerMessage = `📋 <b>Catat Tarbiyah${modeText} - ${today}</b>\n👤 <b>Nama:</b> ${user.display_name}${teamText}\n\nSilakan klik untuk setiap aktivitas tarbiyah:`;
  bot.sendMessage(msg.chat.id, headerMessage, { parse_mode: 'HTML' });

  // Send each tarbiyah point as separate message
  for (let i = 0; i < tarbiyahPoints.length; i++) {
    const point = tarbiyahPoints[i];
    const statusInfo = getTarbiyahStatus(todayData?.record, point.key);

    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Sudah', callback_data: `tarbiyah_${point.key}_done_${requestedMode}` },
        { text: '❌ Belum', callback_data: `tarbiyah_${point.key}_undone_${requestedMode}` },
        { text: '🔄 Udzhur', callback_data: `tarbiyah_${point.key}_udzhur_${requestedMode}` }
      ]]
    };

    const message = `${i + 1}. <b>${point.label}</b>\nStatus: ${statusInfo.text}`;
    
    await bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
});

bot.onText(/\/status/, async (msg) => {
  if (msg.chat.type !== 'private') return;

  // Check if database is available
  if (!process.env.DATABASE_URL) {
    return bot.sendMessage(msg.chat.id, 
      '⚠️ <b>Bot sedang dalam mode maintenance</b>\n\n' +
      'Database sedang dikonfigurasi. Silakan coba lagi nanti.',
      { parse_mode: 'HTML' }
    );
  }

  const user = await findOrCreateUser(msg.from);
  if (!user || !user.display_name) {
    let message = 'Silakan lengkapi registrasi Anda terlebih dahulu:\n\n';
    
    if (!user || !user.display_name) {
      message += '1. Set nama dengan: <b>Nama: [nama anda]</b>\n';
    }

    return bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
  }

  const today = moment().tz('Asia/Jakarta').format('DD/MM/YYYY');
  const todayData = await getTodayTarbiyah(msg.from.id);
  
  const teamText = user.is_team_handler ? ' - Handle Tim' : '';
  let message = `📊 <b>Status Tarbiyah - ${today}</b>\n👤 <b>Nama:</b> ${user.display_name}${teamText}\n\n`;

  if (todayData) {
    const { record: todayRecord, mode: userMode } = todayData;
    let completedCount = 0;
    
    // Get points based on user's mode today (normal or haid)
    const isHaidMode = userMode === 'haid';
    const tarbiyahPoints = getTarbiyahPoints(user.is_team_handler || false, isHaidMode);
    
    const modeText = isHaidMode ? ' (Mode Haid)' : '';
    message = `📊 <b>Status Tarbiyah - ${today}${modeText}</b>\n👤 <b>Nama:</b> ${user.display_name}${teamText}\n\n`;
    
    tarbiyahPoints.forEach(point => {
      const statusInfo = getTarbiyahStatus(todayRecord, point.key);
      message += `${statusInfo.emoji} ${point.label}`;
      
      if (statusInfo.reason) {
        message += ` (${statusInfo.reason})`;
      }
      message += '\n';
      
      if (statusInfo.isCompleted) completedCount++;
    });

    const percentage = Math.round((completedCount / tarbiyahPoints.length) * 100);
    message += `\n📈 <b>Progress:</b> ${completedCount}/${tarbiyahPoints.length} (${percentage}%)`;
    
    message += `\n\n💡 <b>Tips:</b>\n• Gunakan /catat untuk mode normal\n• Gunakan /catat haid untuk mode haid`;
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
                        `📝 <b>Langkah selanjutnya:</b>\n` +
                        `Apakah Anda handle tim (koordinator)?`;

    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Ya, saya handle tim', callback_data: 'setup_team_yes' },
        { text: '❌ Tidak handle tim', callback_data: 'setup_team_no' }
      ]]
    };

    bot.sendMessage(msg.chat.id, responseText, { 
      parse_mode: 'HTML',
      reply_markup: keyboard 
    });
  } else {
    bot.sendMessage(msg.chat.id, '❌ Gagal menyimpan nama. Silakan coba lagi.');
  }
});

// Handle udzhur reason input
bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return;
  if (msg.text && (msg.text.startsWith('/') || msg.text.toLowerCase().startsWith('nama:'))) return;
  
  // Check if user is in udzhur input state
  const udzhurState = await getUdzhurState(msg.from.id);
  if (udzhurState && msg.text) {
    const reason = msg.text.trim();
    
    if (reason.length < 3) {
      return bot.sendMessage(msg.chat.id, 
        '❌ Alasan udzhur terlalu singkat. Silakan berikan alasan yang lebih detail (minimal 3 karakter).'
      );
    }
    
    if (reason.length > 100) {
      return bot.sendMessage(msg.chat.id, 
        '❌ Alasan udzhur terlalu panjang. Maksimal 100 karakter.'
      );
    }
    
    // Save udzhur with reason
    const success = await updateTarbiyahPoint(msg.from.id, udzhurState.point_key, null, reason, udzhurState.mode);
    
    if (success) {
      await clearUdzhurState(msg.from.id);
      
      const responseText = `✅ <b>Udzhur berhasil disimpan</b>\n\n` +
                          `Poin: <b>${udzhurState.point_label}</b>\n` +
                          `Alasan: <b>${reason}</b>\n\n` +
                          `💡 <i>Gunakan /catat${udzhurState.mode === 'haid' ? ' haid' : ''} untuk melihat semua status atau mengedit.</i>`;
      
      bot.sendMessage(msg.chat.id, responseText, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(msg.chat.id, '❌ Gagal menyimpan udzhur. Silakan coba lagi.');
    }
  }
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  const data = query.data;

  // Handle mode change confirmation
  if (data.startsWith('change_mode_')) {
    if (data === 'change_mode_cancel') {
      bot.editMessageText('❌ <b>Penggantian mode dibatalkan</b>\n\nData tarbiyah Anda tetap aman.', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      });
      bot.answerCallbackQuery(query.id, { text: 'Dibatalkan' });
      return;
    }
    
    if (data.includes('_confirm')) {
      const newMode = data.includes('haid') ? 'haid' : 'normal';
      const success = await clearUserDailyData(query.from.id, newMode);
      
      if (success) {
        const modeText = newMode === 'haid' ? 'Mode Haid' : 'Mode Normal';
        bot.editMessageText(`✅ <b>Mode berhasil diubah ke ${modeText}</b>\n\nData tarbiyah hari ini telah dihapus dan siap dimulai dari awal.\n\n💡 Gunakan /catat${newMode === 'haid' ? ' haid' : ''} untuk mulai mencatat.`, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'HTML'
        });
        bot.answerCallbackQuery(query.id, { text: `Mode diubah ke ${modeText}` });
      } else {
        bot.answerCallbackQuery(query.id, { text: 'Error mengubah mode' });
      }
      return;
    }
  }

  // Handle team setup
  if (data === 'setup_team_yes' || data === 'setup_team_no') {
    const isTeamHandler = data === 'setup_team_yes';
    const success = await updateUserTeamHandler(query.from.id, isTeamHandler);
    
    if (success) {
      const statusText = isTeamHandler ? 'Handle Tim' : 'Tidak Handle Tim';
      const responseText = `✅ Status berhasil disimpan: <b>${statusText}</b>\n\n` +
                          `🎉 <b>Registrasi selesai!</b>\n\n` +
                          `Sekarang Anda bisa menggunakan:\n` +
                          `• /catat - untuk mencatat tarbiyah normal\n` +
                          `• /catat haid - untuk mencatat tarbiyah mode haid\n` +
                          `• /status - untuk melihat status tarbiyah\n` +
                          `• /settim - untuk mengubah status handle tim`;

      bot.editMessageText(responseText, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML'
      });
      
      bot.answerCallbackQuery(query.id, { text: 'Registrasi selesai!' });
    } else {
      bot.answerCallbackQuery(query.id, { text: 'Error menyimpan data' });
    }
    return;
  }

  // Handle tarbiyah updates
  if (data.startsWith('tarbiyah_')) {
    const parts = data.split('_');
    if (parts.length >= 4) {
      const action = parts[parts.length - 2]; // done, undone, or udzhur
      const mode = parts[parts.length - 1]; // normal or haid
      const pointKey = parts.slice(1, -2).join('_');
      
      // Get user info to determine correct tarbiyah points
      const user = await findOrCreateUser(query.from);
      const isHaidMode = mode === 'haid';
      const tarbiyahPoints = getTarbiyahPoints(user.is_team_handler, isHaidMode);
      const point = tarbiyahPoints.find(p => p.key === pointKey);
      
      if (point) {
        if (action === 'udzhur') {
          // Set udzhur state and ask for reason
          await setUdzhurState(query.from.id, pointKey, mode, point.label);
          
          const message = `🔄 <b>Input Alasan Udzhur</b>\n\n` +
                         `Poin: <b>${point.label}</b>\n\n` +
                         `Silakan ketik alasan udzhur Anda:`;
          
          bot.editMessageText(message, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            parse_mode: 'HTML'
          });
          
          bot.answerCallbackQuery(query.id, { text: 'Silakan ketik alasan udzhur' });
        } else {
          // Handle done/undone normally
          const value = action === 'done';
          const success = await updateTarbiyahPoint(query.from.id, pointKey, value, null, mode);
          
          if (success) {
            const index = tarbiyahPoints.findIndex(p => p.key === pointKey);
            const status = value ? '✅ Sudah' : '❌ Belum';
            const message = `${index + 1}. <b>${point.label}</b>\nStatus: ${status}\n\n✅ <i>Tersimpan! Gunakan /catat${isHaidMode ? ' haid' : ''} untuk mengedit.</i>`;
            
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
  }
});

// Daily Report Function
async function sendDailyReport() {
  try {
    const today = moment().tz('Asia/Jakarta');
    const todayStr = today.format('YYYY-MM-DD');
    const formattedDate = today.format('dddd, D MMMM YYYY');
    
    // Get all users with their today's records and modes
    const result = await pool.query(`
      SELECT u.telegram_id, u.display_name, u.is_team_handler,
             tr.point_key, tr.status, tr.udzhur_reason,
             udm.mode
      FROM users u
      LEFT JOIN tarbiyah_records tr ON u.telegram_id = tr.telegram_id AND tr.record_date = $1
      LEFT JOIN user_daily_modes udm ON u.telegram_id = udm.telegram_id AND udm.record_date = $1
      WHERE u.display_name IS NOT NULL
      ORDER BY u.display_name, tr.point_key
    `, [todayStr]);

    const usersData = {};
    
    // Group data by user
    result.rows.forEach(row => {
      if (!usersData[row.telegram_id]) {
        usersData[row.telegram_id] = {
          display_name: row.display_name,
          is_team_handler: row.is_team_handler,
          records: {},
          mode: row.mode || 'normal' // Use mode from user_daily_modes table
        };
      }
      
      if (row.point_key) {
        if (row.status === 'udzhur') {
          usersData[row.telegram_id].records[row.point_key] = {
            status: 'udzhur',
            reason: row.udzhur_reason
          };
        } else {
          usersData[row.telegram_id].records[row.point_key] = row.status === 'done';
        }
      }
    });

    let allReports = `📊 <b>LAPORAN HARIAN TARBIYAH</b>\n${formattedDate}\n\n`;
    let reportCount = 0;

    for (const [userId, userData] of Object.entries(usersData)) {
      if (Object.keys(userData.records).length > 0) {
        let completedCount = 0;
        let notCompletedCount = 0;

        // Determine mode from database records
        const isHaidMode = userData.mode === 'haid';
        
        // Get appropriate tarbiyah points for this user
        const tarbiyahPoints = getTarbiyahPoints(userData.is_team_handler || false, isHaidMode);

        const teamText = userData.is_team_handler ? ' (Handle Tim)' : '';
        const modeText = isHaidMode ? ' - Mode Haid' : '';
        let reportMessage = `${userData.display_name}${teamText}${modeText}\n=====================\n`;

        tarbiyahPoints.forEach((point, index) => {
          const value = userData.records[point.key];
          let status, isCompleted;
          
          if (!value) {
            status = '❌';
            isCompleted = false;
          } else if (typeof value === 'object' && value.status === 'udzhur') {
            status = `🔄 (${value.reason})`;
            isCompleted = true; // Udzhur counts as completed
          } else if (value === true) {
            status = '✅';
            isCompleted = true;
          } else {
            status = '❌';
            isCompleted = false;
          }
          
          const pointNumber = index + 1;
          reportMessage += `${pointNumber}. ${point.reportLabel} : ${status}\n`;

          if (isCompleted) {
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

// Command to set team handler status
bot.onText(/\/settim/, async (msg) => {
  if (msg.chat.type !== 'private') return;

  const user = await findOrCreateUser(msg.from);
  if (!user || !user.display_name) {
    return bot.sendMessage(msg.chat.id, 
      'Silakan set nama Anda terlebih dahulu dengan mengetik: <b>Nama: [nama anda]</b>',
      { parse_mode: 'HTML' }
    );
  }

  const currentStatus = user.is_team_handler ? 'Handle Tim' : 'Tidak Handle Tim';
  const responseText = `🔧 <b>Pengaturan Status Tim</b>\n\n` +
                      `Status saat ini: <b>${currentStatus}</b>\n\n` +
                      `Apakah Anda handle tim (koordinator)?`;

  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Ya, saya handle tim', callback_data: 'setup_team_yes' },
      { text: '❌ Tidak handle tim', callback_data: 'setup_team_no' }
    ]]
  };

  bot.sendMessage(msg.chat.id, responseText, { 
    parse_mode: 'HTML',
    reply_markup: keyboard 
  });
});

// Admin debug command
bot.onText(/\/debug/, async (msg) => {
  if (msg.from.id !== ADMIN_USER_ID) return;
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    const debugInfo = `🔧 <b>Debug Info</b>\n\n` +
                     `✅ Database: Connected\n` +
                     `🕐 Server Time: ${result.rows[0].current_time}\n` +
                     `🤖 Bot: Running\n` +
                     `🌐 Environment: ${process.env.NODE_ENV || 'development'}`;
    
    bot.sendMessage(msg.chat.id, debugInfo, { parse_mode: 'HTML' });
  } catch (error) {
    const errorInfo = `❌ <b>Debug Error</b>\n\n` +
                     `Database: ${error.message}\n` +
                     `Environment: ${process.env.NODE_ENV || 'development'}`;
    
    bot.sendMessage(msg.chat.id, errorInfo, { parse_mode: 'HTML' });
  }
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
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as db_time');
    client.release();
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL Connected',
      db_time: result.rows[0].db_time,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL Error',
      error: error.message,
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Initialize and start
async function start() {
  try {
    console.log('🚀 Starting Tarbiyah Bot...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Database URL configured:', process.env.DATABASE_URL ? 'Yes' : 'No');
    
    // Debug: Print partial DATABASE_URL for verification (mask password)
    if (process.env.DATABASE_URL) {
      const dbUrl = process.env.DATABASE_URL;
      const maskedUrl = dbUrl.replace(/:([^:@]*@)/g, ':***@');
      console.log('Database URL (masked):', maskedUrl);
    } else {
      console.log('❌ DATABASE_URL environment variable is not set!');
    }
    
    // Only initialize database if DATABASE_URL is configured
    if (process.env.DATABASE_URL) {
      await initDatabase();
      console.log('🐘 Using PostgreSQL Database (Persistent & Reliable!)');
    } else {
      console.log('⚠️  WARNING: DATABASE_URL not configured');
      console.log('📄 Bot will run without database (temporary mode)');
      console.log('🔧 Please set DATABASE_URL environment variable in Render Dashboard');
    }
    
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
      console.log(`🚀 Tarbiyah Bot running on port ${PORT}`);
      console.log(`� Bot ready to receive messages`);
      
      if (!process.env.DATABASE_URL) {
        console.log(`\n⚠️  IMPORTANT: Set these environment variables in Render:`);
        console.log(`DATABASE_URL=postgresql://madhasoeki_user:QfwcwjEUmh1s76LCSPJ4DWgnvLWtkd8t@dpg-d2skhcmmcj7s73a9adr0-a.oregon-postgres.render.com/madhasoeki`);
        console.log(`BOT_TOKEN=8382967299:AAGXrPv87BXrIchMpqmdVDHRtdZnHpSBz4w`);
        console.log(`ADMIN_USER_ID=5077067370`);
        console.log(`GROUP_CHAT_ID=-1002295813671`);
        console.log(`MESSAGE_THREAD_ID=1971`);
        console.log(`NODE_ENV=production\n`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    console.log('🔄 Trying to start without database...');
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Tarbiyah Bot running on port ${PORT} (Database disabled)`);
    });
  }
}

start();
