const { Telegraf, Markup, session } = require('telegraf');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { ethers } = require('ethers');

// ========== НАСТРОЙКИ ДЛЯ НОВОГО БОТА ==========
// !!! НОВЫЙ ТОКЕН ДЛЯ БОТА @Zuz_Universe_bot !!!
const BOT_TOKEN = '8727123104:AAHs4JCrsMY7ViaQQNtGdldkxuB31F3t3Yg';
// !!! АДРЕС ВАШЕГО MINI APP (НЕ МЕНЯЙТЕ) !!!
const MINI_APP_URL = 'https://zuzumiverse-bot.onrender.com';
// =============================================

const WEBSITE = 'https://zuzim-universe.com';
const TOKEN_ADDRESS = '0x87D336511760583B11B87866654c6f7253c1cB0D';

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ========== БАЗА ДАННЫХ ==========
let db;
async function initDB() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      wallet_address TEXT,
      private_key TEXT,
      balance_zuz REAL DEFAULT 0,
      staked_zuz REAL DEFAULT 0,
      referrer_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER,
      referred_id INTEGER,
      earned_zuz REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Database initialized');
  return db;
}
function getDB() { return db; }

// ========== УРОВНИ МУДРЕЦОВ ==========
const SAGE_LEVELS = [
  { name: "🌱 Novice", threshold: 0, bonus: 0, next: 1000 },
  { name: "📜 Wisdom", threshold: 1000, bonus: 2, next: 5000 },
  { name: "🌾 Prosperity", threshold: 5000, bonus: 5, next: 10000 },
  { name: "🛡️ Protection", threshold: 10000, bonus: 10, next: 25000 },
  { name: "⚡ Innovation", threshold: 25000, bonus: 15, next: 50000 },
  { name: "☯️ Harmony", threshold: 50000, bonus: 20, next: 100000 },
  { name: "⚔️ Power", threshold: 100000, bonus: 25, next: 250000 },
  { name: "👑 Immortality", threshold: 250000, bonus: 30, next: Infinity }
];
function getSageLevel(balanceZuz) {
  for (let i = SAGE_LEVELS.length - 1; i >= 0; i--) {
    if (balanceZuz >= SAGE_LEVELS[i].threshold) return SAGE_LEVELS[i];
  }
  return SAGE_LEVELS[0];
}

// ========== ГЕНЕРАЦИЯ КОШЕЛЬКА ==========
function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

// ========== КЛАВИАТУРЫ ==========
const mainKeyboard = () => Markup.keyboard([
  ['🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ'],
  ['🏠 Главная', '💰 Мой баланс'],
  ['👥 Партнёры', '❓ Помощь']
]).resize();

// ========== ОБРАБОТЧИКИ ==========
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  let user = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
  if (!user) {
    const { address, privateKey } = generateWallet();
    await db.run('INSERT INTO users (user_id, wallet_address, private_key) VALUES (?, ?, ?)', userId, address, privateKey);
    const args = ctx.message.text.split(' ');
    if (args[1] && args[1].startsWith('ref_')) {
      const referrerId = parseInt(args[1].replace('ref_', ''));
      if (referrerId !== userId) {
        await db.run('UPDATE users SET referrer_id = ? WHERE user_id = ?', referrerId, userId);
        await ctx.reply('🎉 Вы приглашены другом!');
      }
    }
  }
  const newUser = await db.get('SELECT wallet_address FROM users WHERE user_id = ?', userId);
  
  await ctx.reply(
    `✨ *Добро пожаловать в ZUZ Universe!* ✨\n\n` +
    `Ваш кошелёк создан:\n` +
    `\`${newUser.wallet_address}\`\n\n` +
    `⚡ *Time > Money*\n\n` +
    `👇 Нажмите кнопку ниже, чтобы открыть приложение.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
      ])
    }
  );
  await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
});

bot.hears('🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ', async (ctx) => {
  await ctx.reply(`👇 Нажмите кнопку ниже:`, {
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
    ])
  });
});

bot.hears('🏠 Главная', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
  const sage = getSageLevel(user?.balance_zuz || 0);
  await ctx.reply(
    `🏛️ *ZUZ UNIVERSE*\n\n👤 *Ваш профиль:*\n└ Ранг: ${sage.name}\n└ Бонус: +${sage.bonus}%\n└ ID: \`${userId}\`\n\n📢 *Новости:*\n└ Пресейл активен до 1 июля 2026\n└ Осталось 68 бонусных мест!\n\n🚀 Нажмите "ОТКРЫТЬ ПРИЛОЖЕНИЕ" для покупки токенов!`,
    { parse_mode: 'Markdown' }
  );
});

bot.hears('💰 Мой баланс', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT balance_zuz, staked_zuz FROM users WHERE user_id = ?', userId);
  ctx.session.showBalance = ctx.session.showBalance === undefined ? false : ctx.session.showBalance;
  const eye = ctx.session.showBalance ? '👁️' : '👁️‍🗨️';
  const balanceText = ctx.session.showBalance ? `${(user?.balance_zuz || 0).toLocaleString()} ZUZ` : '***';
  await ctx.reply(
    `💰 *Ваш баланс*\n\nZUZ: ${balanceText}\nВ стейкинге: ${(user?.staked_zuz || 0).toLocaleString()} ZUZ\n\n${eye} Баланс скрыт`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([ [Markup.button.callback(`${ctx.session.showBalance ? '🙈 Скрыть' : '👁️ Показать'}`, 'toggle_balance')] ]) }
  );
});

bot.action('toggle_balance', async (ctx) => {
  ctx.session.showBalance = !ctx.session.showBalance;
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  await bot.hears('💰 Мой баланс', ctx);
});

bot.hears('👥 Партнёры', async (ctx) => {
  const userId = ctx.from.id;
  // Используем правильное имя нового бота
  const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
  const db = getDB();
  const referrals = await db.all('SELECT * FROM referrals WHERE referrer_id = ?', userId);
  await ctx.reply(
    `👥 *Партнёрская программа*\n\nПриглашайте друзей и получайте *5%* от их покупок!\n\n🔗 *Ваша ссылка:*\n\`${refLink}\`\n\n📊 *Статистика:*\n└ Приглашено: ${referrals.length}\n└ Заработано: ${referrals.reduce((sum, r) => sum + (r.earned_zuz || 0), 0).toLocaleString()} ZUZ`,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([ [Markup.button.callback('📋 Копировать ссылку', 'copy_ref')] ]) }
  );
});

bot.action('copy_ref', async (ctx) => {
  const userId = ctx.from.id;
  const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
  await ctx.answerCbQuery();
  await ctx.reply(`🔗 \`${refLink}\``, { parse_mode: 'Markdown' });
});

bot.hears('❓ Помощь', async (ctx) => {
  await ctx.reply(
    `❓ *Помощь ZUZ Universe*\n\n📖 *Доступные команды:*\n/start - Перезапустить бота\n/wallet - Показать адрес кошелька\n/referral - Партнёрская ссылка\n\n🔗 *Полезные ссылки:*\n[Сайт](${WEBSITE})\n[Twitter](https://x.com/zuzim_universe)\n[Telegram](https://t.me/zuzimuniverse)\n\n📞 *Поддержка:* @zuzimuniverse`,
    { parse_mode: 'Markdown', disable_web_page_preview: true }
  );
});

bot.command('wallet', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT wallet_address FROM users WHERE user_id = ?', userId);
  await ctx.reply(`🔑 *Ваш кошелёк:*\n\`${user?.wallet_address}\``, { parse_mode: 'Markdown' });
});
bot.command('referral', async (ctx) => {
  const userId = ctx.from.id;
  const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
  await ctx.reply(`🔗 \`${refLink}\``, { parse_mode: 'Markdown' });
});
bot.hears('🔙 Назад', async (ctx) => {
  await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
});

async function start() {
  await initDB();
  await bot.launch();
  console.log('🚀 Новый бот ZUZ Universe запущен!');
  console.log('📱 https://t.me/Zuz_Universe_bot');
  console.log(`🎯 Mini App URL: ${MINI_APP_URL}`);
}
start();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
