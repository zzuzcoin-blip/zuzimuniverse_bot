const { Telegraf, Markup, session } = require('telegraf');

// НОВЫЙ ТОКЕН ДЛЯ БОТА @Zuz_Universe_bot
const BOT_TOKEN = '8727123104:AAHs4JCrsMY7ViaQQNtGdldkxuB31F3t3Yg';
const MINI_APP_URL = 'https://zuzumiverse-bot.onrender.com';

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Клавиатура главного меню (всегда одна и та же)
const mainKeyboard = () => Markup.keyboard([
    ['🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ'],
    ['🏠 Главная', '💰 Мой баланс'],
    ['👥 Партнёры', '❓ Помощь']
]).resize();

// Функция отправки меню (можно вызывать из любого места)
async function sendMainMenu(ctx, text) {
    await ctx.reply(text || '🏠 *Главное меню*', {
        parse_mode: 'Markdown',
        ...mainKeyboard()
    });
}

// Команда /start
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
    
    await ctx.reply(
        `✨ *Добро пожаловать в ZUZ Universe!* ✨\n\n` +
        `⚡ *Time > Money*\n\n` +
        `👇 Нажмите кнопку ниже, чтобы открыть приложение.`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
            ])
        }
    );
    
    await sendMainMenu(ctx);
});

// Кнопка открытия приложения
bot.hears('🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ', async (ctx) => {
    await ctx.reply(
        `👇 Нажмите кнопку ниже:`,
        {
            ...Markup.inlineKeyboard([
                [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
            ])
        }
    );
});

// Главная
bot.hears('🏠 Главная', async (ctx) => {
    await ctx.reply(
        `🏛️ *ZUZ UNIVERSE*\n\n` +
        `📜 *7 мудрецов* — ваш путь к величию.\n` +
        `💰 Чем больше ZUZ — тем выше ранг.\n` +
        `🎁 Бонус к стейкингу до +30%.\n\n` +
        `🚀 Нажмите "ОТКРЫТЬ ПРИЛОЖЕНИЕ" для покупки токенов и стейкинга.`,
        { parse_mode: 'Markdown' }
    );
});

// Баланс (с кнопкой "глаз")
bot.hears('💰 Мой баланс', async (ctx) => {
    const userId = ctx.from.id;
    
    // Простая проверка баланса (без базы данных)
    ctx.session.showBalance = ctx.session.showBalance === undefined ? false : ctx.session.showBalance;
    const eye = ctx.session.showBalance ? '👁️' : '👁️‍🗨️';
    const balanceText = ctx.session.showBalance ? '1,250 ZUZ' : '***';
    
    await ctx.reply(
        `💰 *Ваш баланс*\n\n` +
        `ZUZ: ${balanceText}\n` +
        `В стейкинге: 0 ZUZ\n\n` +
        `${eye} Баланс скрыт`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`${ctx.session.showBalance ? '🙈 Скрыть' : '👁️ Показать'}`, 'toggle_balance')]
            ])
        }
    );
});

// Обработка кнопки "глаз"
bot.action('toggle_balance', async (ctx) => {
    ctx.session.showBalance = !ctx.session.showBalance;
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    // Вызываем обработчик баланса заново
    await bot.hears('💰 Мой баланс', ctx);
});

// Партнёры
bot.hears('👥 Партнёры', async (ctx) => {
    const userId = ctx.from.id;
    const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
    
    await ctx.reply(
        `👥 *Партнёрская программа*\n\n` +
        `Приглашайте друзей и получайте *5%* от их покупок!\n\n` +
        `🔗 *Ваша ссылка:*\n` +
        `\`${refLink}\`\n\n` +
        `📊 *Ваши партнёры: 0*\n` +
        `💰 *Заработано: 0 ZUZ*`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📋 Копировать ссылку', 'copy_ref')]
            ])
        }
    );
});

bot.action('copy_ref', async (ctx) => {
    const userId = ctx.from.id;
    const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
    await ctx.answerCbQuery();
    await ctx.reply(`🔗 \`${refLink}\``, { parse_mode: 'Markdown' });
});

// Помощь
bot.hears('❓ Помощь', async (ctx) => {
    await ctx.reply(
        `❓ *Помощь ZUZ Universe*\n\n` +
        `📖 *Команды:*\n` +
        `/start - перезапустить бота\n` +
        `/wallet - показать адрес кошелька\n` +
        `/referral - партнёрская ссылка\n\n` +
        `🔗 *Полезные ссылки:*\n` +
        `[Сайт](https://zuzim-universe.com)\n` +
        `[Twitter](https://x.com/zuzim_universe)\n` +
        `[Telegram](https://t.me/zuzimuniverse)\n\n` +
        `📞 *Поддержка:* @zuzimuniverse`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
});

// Команда /wallet
bot.command('wallet', async (ctx) => {
    // Здесь можно добавить реальный адрес из базы
    await ctx.reply(`🔑 *Ваш кошелёк:*\n\`0x675f757B56B6A6df77f62B705925401B287f1C30\``, { parse_mode: 'Markdown' });
});

// Команда /referral
bot.command('referral', async (ctx) => {
    const userId = ctx.from.id;
    const refLink = `https://t.me/Zuz_Universe_bot?start=ref_${userId}`;
    await ctx.reply(`🔗 \`${refLink}\``, { parse_mode: 'Markdown' });
});

// Кнопка "Назад" (если нужно)
bot.hears('🔙 Назад', async (ctx) => {
    await sendMainMenu(ctx);
});

// Обработка любых других сообщений — отправляем меню
bot.on('text', async (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        await sendMainMenu(ctx, '🏠 *Главное меню*');
    }
});

// Запуск бота
async function start() {
    await bot.launch();
    console.log('🚀 Бот ZUZ Universe запущен!');
    console.log('📱 https://t.me/Zuz_Universe_bot');
    console.log('🎯 Mini App URL:', MINI_APP_URL);
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
