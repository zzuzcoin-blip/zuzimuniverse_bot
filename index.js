require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { initDB, getDB } = require('./database');
const Web3 = require('web3');
const { ethers } = require('ethers');

// Конфиг
const BOT_TOKEN = process.env.BOT_TOKEN;
const RPC_URL = process.env.RPC_URL;
const PRESALE_ADDRESS = process.env.PRESALE_CONTRACT;
const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT;
const TOKEN_PRICE_ETH = parseFloat(process.env.TOKEN_PRICE_ETH);
const MIN_PURCHASE_ETH = parseFloat(process.env.MIN_PURCHASE_ETH);
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;

// ABIs
const PRESALE_ABI = [
  "function buyTokens() external payable",
  "function tokensSold() view returns (uint256)",
  "function maxTokensToSell() view returns (uint256)"
];
const TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// Инициализация
const web3 = new Web3(RPC_URL);
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Уровни мудрецов
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

// Генерация кошелька для пользователя
function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase
  };
}

// Клавиатуры
const mainKeyboard = () => Markup.keyboard([
  ['🏠 Главная', '💰 Мой баланс'],
  ['📊 Стейкинг', '💱 Обмен / DEX'],
  ['👥 Партнёры', '🎁 Реварды'],
  ['📜 Активность', '🧙‍♂️ Ранг Мудреца'],
  ['⚙️ Настройки', '❓ Помощь']
]).resize();

// Кнопка "Назад" для подменю
const backButton = () => Markup.keyboard([['🔙 Назад']]).resize();

// Обработчик команды /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  
  let user = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
  
  if (!user) {
    const { address, privateKey } = generateWallet();
    await db.run(
      'INSERT INTO users (user_id, wallet_address, private_key) VALUES (?, ?, ?)',
      userId, address, privateKey
    );
    
    // Обработка реферальной ссылки
    const args = ctx.message.text.split(' ');
    if (args[1] && args[1].startsWith('ref_')) {
      const referrerId = parseInt(args[1].replace('ref_', ''));
      if (referrerId !== userId) {
        await db.run('UPDATE users SET referrer_id = ? WHERE user_id = ?', referrerId, userId);
        await ctx.reply('🎉 Вы приглашены другом! Вам будет начисляться 5% от его покупок.');
      }
    }
  }
  
  await ctx.reply(
    `✨ *Добро пожаловать в ZUZ Universe!* ✨\n\n` +
    `Ваш кошелёк создан:\n` +
    `\`${user?.wallet_address || (await db.get('SELECT wallet_address FROM users WHERE user_id = ?', userId)).wallet_address}\`\n\n` +
    `⚡ *Time > Money*\n` +
    `Присоединяйтесь к сообществу 7 мудрецов!`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
});

// Обработчик текстовых сообщений
bot.hears('🏠 Главная', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
  const sage = getSageLevel(user?.balance_zuz || 0);
  
  await ctx.reply(
    `🏛️ *ZUZ UNIVERSE* 🏛️\n\n` +
    `👤 *Ваш профиль:*\n` +
    `└ Ранг: ${sage.name}\n` +
    `└ Бонус стейкинга: +${sage.bonus}%\n` +
    `└ ID: \`${userId}\`\n\n` +
    `📢 *Новости:*\n` +
    `└ Пресейл активен до 1 июля 2026\n` +
    `└ ${68 - (user?.referrals_count || 0)} бонусных мест осталось!\n\n` +
    `💡 *Совет:* Приглашайте друзей и получайте 5% от их покупок!`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
});

bot.hears('💰 Мой баланс', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT balance_eth, balance_zuz, staked_zuz FROM users WHERE user_id = ?', userId);
  
  // Скрытый баланс по умолчанию
  ctx.session.showBalance = ctx.session.showBalance === undefined ? false : ctx.session.showBalance;
  
  const eye = ctx.session.showBalance ? '👁️' : '👁️‍🗨️';
  const balanceText = ctx.session.showBalance
    ? `└ ZUZ: ${(user?.balance_zuz || 0).toLocaleString()} ZUZ\n└ ETH: ${(user?.balance_eth || 0).toFixed(4)} ETH`
    : '└ *Скрыто* (нажмите 👁️ для просмотра)';
  
  await ctx.reply(
    `💰 *Ваш баланс*\n\n` +
    `${balanceText}\n` +
    `└ В стейкинге: ${(user?.staked_zuz || 0).toLocaleString()} ZUZ\n\n` +
    `*${eye} Баланс скрыт* — нажмите кнопку ниже, чтобы показать/скрыть`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(`${ctx.session.showBalance ? 'Скрыть' : 'Показать'} баланс`, 'toggle_balance')],
        [Markup.button.callback('🔄 Обновить', 'refresh_balance')]
      ])
    }
  );
});

// Инлайн кнопки для баланса
bot.action('toggle_balance', async (ctx) => {
  ctx.session.showBalance = !ctx.session.showBalance;
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  // Запускаем заново обработчик
  await bot.hears('💰 Мой баланс', ctx);
});

bot.action('refresh_balance', async (ctx) => {
  await ctx.answerCbQuery('♻️ Баланс обновлён');
  await ctx.deleteMessage();
  await bot.hears('💰 Мой баланс', ctx);
});

// Стейкинг
bot.hears('📊 Стейкинг', async (ctx) => {
  await ctx.reply(
    `🏦 *ZUZ Staking Pool*\n\n` +
    `📈 *APY:* 25%\n` +
    `🔒 *Блокировка:* нет (снимайте в любой момент)\n` +
    `🎁 *Бонус:* +0-30% в зависимости от ранга\n\n` +
    `*Ваши награды:* 0 ZUZ\n` +
    `*Застейкано:* 0 ZUZ\n\n` +
    `⬇️ Выберите действие:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔒 Застейкать ZUZ', 'stake_zuz')],
        [Markup.button.callback('💰 Забрать награды', 'claim_rewards')],
        [Markup.button.callback('🔓 Вывести из стейкинга', 'unstake_zuz')]
      ])
    }
  );
});

// Обмен / DEX
bot.hears('💱 Обмен / DEX', async (ctx) => {
  await ctx.reply(
    `💱 *Обмен ZUZ*\n\n` +
    `🎯 *Пресейл:* 1 ZUZ = ${TOKEN_PRICE_ETH} ETH\n` +
    `💰 *Мин. покупка:* ${MIN_PURCHASE_ETH} ETH\n\n` +
    `📊 *Uniswap:* после пресейла\n` +
    `🔗 ${TOKEN_ADDRESS}\n\n` +
    `👇 Выберите способ:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🛒 Купить ZUZ (пресейл)', 'buy_zuz')],
        [Markup.button.callback('🔄 Swap на Uniswap (скоро)', 'uniswap_soon')],
        [Markup.button.callback('➕ Добавить ZUZ в кошелёк', 'add_token')]
      ])
    }
  );
});

// Покупка ZUZ
bot.action('buy_zuz', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `🛒 *Покупка ZUZ*\n\n` +
    `Цена: 1 ZUZ = ${TOKEN_PRICE_ETH} ETH\n` +
    `Мин: ${MIN_PURCHASE_ETH} ETH\n` +
    `Макс: без ограничений\n\n` +
    `Отправьте команду:\n` +
    `\`/buy 0.1\` — купить на 0.1 ETH\n\n` +
    `Важно: у вас должен быть ETH в кошельке бота!`,
    { parse_mode: 'Markdown' }
  );
});

// Партнёры
bot.hears('👥 Партнёры', async (ctx) => {
  const userId = ctx.from.id;
  const refLink = `https://t.me/${ctx.botInfo.username}?start=ref_${userId}`;
  
  const db = getDB();
  const referrals = await db.all('SELECT * FROM referrals WHERE referrer_id = ?', userId);
  const totalEarned = referrals.reduce((sum, r) => sum + (r.earned_zuz || 0), 0);
  
  await ctx.reply(
    `👥 *Партнёрская программа*\n\n` +
    `Приглашайте друзей и получайте *5%* от их покупок ZUZ!\n\n` +
    `🔗 *Ваша ссылка:*\n` +
    `${refLink}\n\n` +
    `📊 *Статистика:*\n` +
    `└ Приглашено: ${referrals.length}\n` +
    `└ Заработано: ${totalEarned.toLocaleString()} ZUZ\n\n` +
    `🏆 *Бонус:* топ-3 лидеров получат +10% к стейкингу!`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Копировать ссылку', `copy_ref_${userId}`)]
      ])
    }
  );
});

// Копирование реферальной ссылки
bot.action(/copy_ref_(.+)/, async (ctx) => {
  const refLink = `https://t.me/${ctx.botInfo.username}?start=ref_${ctx.match[1]}`;
  await ctx.answerCbQuery();
  await ctx.reply(`🔗 Ваша ссылка:\n${refLink}\n\nСкопируйте её и отправьте друзьям!`);
});

// Реварды
bot.hears('🎁 Реварды', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT staking_rewards FROM users WHERE user_id = ?', userId);
  
  await ctx.reply(
    `🎁 *Ваши награды*\n\n` +
    `💰 Награды стейкинга: ${(user?.staking_rewards || 0).toLocaleString()} ZUZ\n` +
    `👥 Партнёрские реварды: скоро\n\n` +
    `⬇️ Действия:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Забрать все награды', 'claim_all_rewards')]
      ])
    }
  );
});

// Активность
bot.hears('📜 Активность', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const transactions = await db.all(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    userId
  );
  
  if (transactions.length === 0) {
    await ctx.reply('📜 *История активностей*\n\nПока нет транзакций.', { parse_mode: 'Markdown', ...mainKeyboard() });
    return;
  }
  
  let history = '📜 *История транзакций (последние 10):*\n\n';
  for (const tx of transactions) {
    history += `└ ${tx.type}: ${tx.amount_zuz?.toLocaleString() || ''} ZUZ\n`;
  }
  await ctx.reply(history, { parse_mode: 'Markdown', ...mainKeyboard() });
});

// Ранг мудреца
bot.hears('🧙‍♂️ Ранг Мудреца', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT balance_zuz FROM users WHERE user_id = ?', userId);
  const balance = user?.balance_zuz || 0;
  const currentSage = getSageLevel(balance);
  const nextSage = SAGE_LEVELS.find(l => l.threshold > balance);
  
  let progress = 0;
  let needed = 0;
  if (nextSage) {
    const prevThreshold = currentSage.threshold;
    needed = nextSage.threshold - balance;
    const totalNeeded = nextSage.threshold - prevThreshold;
    const achieved = balance - prevThreshold;
    progress = (achieved / totalNeeded) * 100;
  } else {
    progress = 100;
  }
  
  await ctx.reply(
    `🧙‍♂️ *Ваш путь мудреца*\n\n` +
    `🏆 *Текущий ранг:* ${currentSage.name}\n` +
    `✨ *Бонус к стейкингу:* +${currentSage.bonus}%\n` +
    `📊 *Баланс:* ${balance.toLocaleString()} ZUZ\n\n` +
    (nextSage ? `🎯 *До ранга "${nextSage.name}":* ${needed.toLocaleString()} ZUZ\n` : `👑 *Вы достигли бессмертия!*\n`) +
    `└ Прогресс: ${progress.toFixed(1)}%\n` +
    `[${'▓'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))}]\n\n` +
    `💎 *Чем выше ранг — тем больше вы зарабатываете на стейкинге!*`,
    { parse_mode: 'Markdown', ...mainKeyboard() }
  );
});

// Настройки
bot.hears('⚙️ Настройки', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT wallet_address, private_key FROM users WHERE user_id = ?', userId);
  
  await ctx.reply(
    `⚙️ *Настройки аккаунта*\n\n` +
    `🔑 *Ваш адрес:*\n` +
    `\`${user?.wallet_address}\`\n\n` +
    `⚠️ *Ваш приватный ключ (никому не показывайте!):*\n` +
    `||${user?.private_key?.substring(0, 8)}...${user?.private_key?.substring(user?.private_key?.length - 6)}||\n\n` +
    `🔄 *Сеть:* Ethereum Mainnet\n` +
    `🌐 *Язык:* Русский / English\n\n` +
    `⬇️ *Действия:*`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📤 Экспорт приватного ключа (ОПАСНО)', 'export_private')],
        [Markup.button.callback('🗑️ Удалить аккаунт', 'delete_account')]
      ])
    }
  );
});

// Помощь
bot.hears('❓ Помощь', async (ctx) => {
  await ctx.reply(
    `❓ *Помощь ZUZ Universe*\n\n` +
    `📖 *Доступные команды:*\n` +
    `/start - Перезапустить бота\n` +
    `/buy <ETH> - Купить ZUZ (например: /buy 0.1)\n` +
    `/balance - Показать баланс\n` +
    `/wallet - Показать адрес кошелька\n` +
    `/referral - Партнёрская ссылка\n\n` +
    `🔗 *Полезные ссылки:*\n` +
    `[Сайт](${process.env.WEBSITE || 'https://zuzim-universe.com'})\n` +
    `[Twitter](https://x.com/zuzim_universe)\n` +
    `[Telegram](https://t.me/zuzimuniverse)\n\n` +
    `📞 *Поддержка:* @zuzim_support`,
    { parse_mode: 'Markdown', disable_web_page_preview: true, ...mainKeyboard() }
  );
});

// Команда /buy
bot.command('buy', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');
  
  if (args.length < 2) {
    await ctx.reply('❌ Укажите сумму: `/buy 0.1`', { parse_mode: 'Markdown' });
    return;
  }
  
  const ethAmount = parseFloat(args[1]);
  if (isNaN(ethAmount) || ethAmount < MIN_PURCHASE_ETH) {
    await ctx.reply(`❌ Минимальная покупка: ${MIN_PURCHASE_ETH} ETH`);
    return;
  }
  
  const db = getDB();
  const user = await db.get('SELECT wallet_address, private_key, balance_eth FROM users WHERE user_id = ?', userId);
  
  if ((user?.balance_eth || 0) < ethAmount) {
    await ctx.reply(`❌ Недостаточно ETH на балансе бота. Пополните кошелёк:\n\`${user?.wallet_address}\``, { parse_mode: 'Markdown' });
    return;
  }
  
  await ctx.reply(`⏳ Обработка покупки ${ethAmount} ETH...\n⚠️ Функция в разработке. Для реальной покупки нужно пополнить кошелёк и отправить транзакцию.`);
});

// Команда /balance
bot.command('balance', async (ctx) => {
  await bot.hears('💰 Мой баланс', ctx);
});

// Команда /wallet
bot.command('wallet', async (ctx) => {
  const userId = ctx.from.id;
  const db = getDB();
  const user = await db.get('SELECT wallet_address FROM users WHERE user_id = ?', userId);
  await ctx.reply(`🔑 *Ваш кошелёк:*\n\`${user?.wallet_address}\``, { parse_mode: 'Markdown' });
});

// Команда /referral
bot.command('referral', async (ctx) => {
  await bot.hears('👥 Партнёры', ctx);
});

// Кнопка "Назад"
bot.hears('🔙 Назад', async (ctx) => {
  await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
});

// Заглушки для нереализованных действий
bot.action('stake_zuz', async (ctx) => {
  await ctx.answerCbQuery('⚠️ Функция стейкинга будет доступна после пресейла');
});
bot.action('claim_rewards', async (ctx) => {
  await ctx.answerCbQuery('⏳ Награды скоро появятся');
});
bot.action('unstake_zuz', async (ctx) => {
  await ctx.answerCbQuery('⏳ Скоро');
});
bot.action('uniswap_soon', async (ctx) => {
  await ctx.answerCbQuery('Uniswap листинг после пресейла (июль 2026)');
});
bot.action('add_token', async (ctx) => {
  await ctx.answerCbQuery('Добавьте вручную: ' + TOKEN_ADDRESS);
});
bot.action('claim_all_rewards', async (ctx) => {
  await ctx.answerCbQuery('Награды пока 0 ZUZ');
});
bot.action('export_private', async (ctx) => {
  await ctx.answerCbQuery('⚠️ Никогда не передавайте приватный ключ!');
});
bot.action('delete_account', async (ctx) => {
  await ctx.answerCbQuery('Для удаления напишите @zuzim_support');
});

// Запуск бота
async function start() {
  await initDB();
  await bot.launch();
  console.log('🚀 ZUZ Universe Bot запущен!');
  console.log(`📱 Бот: https://t.me/zuzuniverse_bot`);
}

start();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
