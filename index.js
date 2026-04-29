require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { initDB, getDB } = require('./database');
const express = require('express');

// ========== ВЕБ-СЕРВЕР ДЛЯ RENDER (он ничего не делает, только отвечает) ==========
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('ZUZ Universe Bot is running');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Web server (fake) listening on port ${port}`);
});

// ========== КОНФИГ БОТА ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://zuzumiverse-bot.onrender.com';

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ========== КЛАВИАТУРЫ ==========
const mainKeyboard = () => Markup.keyboard([
    ['🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ'],
    ['🏠 Главная', '💰 Мой баланс'],
    ['👥 Партнёры', '❓ Помощь']
]).resize();

const webAppButton = () => Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
]);

// ========== СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ ==========
async function saveUser(ctx) {
    const db = getDB();
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const username = ctx.from.username;
    
    const existing = await db.get('SELECT * FROM users WHERE user_id = ?', userId);
    if (!existing) {
        await db.run(
            'INSERT INTO users (user_id, first_name, username) VALUES (?, ?, ?)',
            userId, firstName, username
        );
        
        const args = ctx.message?.text?.split(' ') || [];
        if (args[0] === '/start' && args[1] && args[1].startsWith('ref_')) {
            const referrerId = parseInt(args[1].replace('ref_', ''));
            if (referrerId !== userId) {
                await db.run('UPDATE users SET referrer_id = ? WHERE user_id = ?', referrerId, userId);
                await db.run(
                    'INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)',
                    referrerId, userId
                );
                await ctx.reply('🎉 Вы приглашены другом! Вам будет начисляться 5% от его покупок.');
            }
        }
    }
    return true;
}

// ========== ОБРАБОТЧИКИ ==========
bot.start(async (ctx) => {
    await saveUser(ctx);
    
    await ctx.reply(
        `✨ *Добро пожаловать в ZUZ Universe!* ✨\n\n` +
        `⚡ *Time > Money*\n\n` +
        `В нашем Mini App вы можете:\n` +
        `• Купить ZUZ за ETH\n` +
        `• Застейкать ZUZ под 25% APY\n` +
        `• Получать реварды и приглашать друзей\n` +
        `• Отслеживать свой ранг мудреца\n\n` +
        `👇 Нажмите кнопку ниже, чтобы открыть приложение.`,
        { parse_mode: 'Markdown', ...webAppButton() }
    );
    
    await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
});

bot.hears('🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ', async (ctx) => {
    await ctx.reply('👇 Откройте ZUZ Universe:', webAppButton());
});

bot.hears('🏠 Главная', async (ctx) => {
    await ctx.reply(
        `🏛️ *ZUZ UNIVERSE*\n\n` +
        `📜 *Путь 7 мудрецов*\n` +
        `Чем больше ZUZ — тем выше ранг.\n` +
        `Бонус к стейкингу до +30%!\n\n` +
        `🚀 Все действия — в Mini App: покупка, стейкинг, реварды, партнёрка.`,
        { parse_mode: 'Markdown', ...webAppButton() }
    );
});

bot.hears('💰 Мой баланс', async (ctx) => {
    const userId = ctx.from.id;
    const db = getDB();
    const user = await db.get('SELECT balance_zuz FROM users WHERE user_id = ?', userId);
    const balance = user?.balance_zuz || 0;
    
    ctx.session.showBalance = ctx.session.showBalance === undefined ? false : ctx.session.showBalance;
    const eye = ctx.session.showBalance ? '👁️' : '👁️‍🗨️';
    const balanceText = ctx.session.showBalance ? `${balance.toLocaleString()} ZUZ` : '***';
    
    await ctx.reply(
        `💰 *Ваш баланс*\n\n` +
        `ZUZ: ${balanceText}\n\n` +
        `📊 *Подробная статистика и стейкинг — в приложении.*`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`${ctx.session.showBalance ? '🙈 Скрыть' : '👁️ Показать'}`, 'toggle_balance')],
                [Markup.button.webApp('🚀 Перейти в приложение', MINI_APP_URL)]
            ])
        }
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
    const refLink = `https://t.me/zuzim_universe_bot?start=ref_${userId}`;
    const db = getDB();
    const referrals = await db.all('SELECT * FROM referrals WHERE referrer_id = ?', userId);
    
    await ctx.reply(
        `👥 *Партнёрская программа*\n\n` +
        `Приглашайте друзей и получайте *5%* от их покупок ZUZ!\n\n` +
        `🔗 *Ваша ссылка:*\n` +
        `\`${refLink}\`\n\n` +
        `📊 *Ваши партнёры:* ${referrals.length}\n` +
        `💰 *Заработано:* ${referrals.reduce((sum, r) => sum + (r.earned_zuz || 0), 0).toLocaleString()} ZUZ\n\n` +
        `🏆 *Бонус:* топ-3 лидеров получат +10% к стейкингу!`,
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
    const refLink = `https://t.me/zuzim_universe_bot?start=ref_${userId}`;
    await ctx.answerCbQuery();
    await ctx.reply(`🔗 \`${refLink}\``, { parse_mode: 'Markdown' });
});

bot.hears('❓ Помощь', async (ctx) => {
    await ctx.reply(
        `❓ *Помощь ZUZ Universe*\n\n` +
        `📖 *Доступные команды:*\n` +
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

bot.command('wallet', async (ctx) => {
    await saveUser(ctx);
    await ctx.reply(
        `🔑 *Ваш кошелёк*\n\n` +
        `Детали кошелька и подключение к MetaMask/Trust Wallet — в Mini App.\n\n` +
        `👇 Откройте приложение:`,
        { parse_mode: 'Markdown', ...webAppButton() }
    );
});

bot.command('referral', async (ctx) => {
    const userId = ctx.from.id;
    const refLink = `https://t.me/zuzim_universe_bot?start=ref_${userId}`;
    await ctx.reply(`🔗 \`${refLink}\``, { parse_mode: 'Markdown' });
});

bot.hears('🔙 Назад', async (ctx) => {
    await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
});

bot.on('text', async (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
    }
});

// ========== ЗАПУСК ==========
async function start() {
    await initDB();
    await bot.launch();
    console.log('🚀 ZUZ Universe Bot запущен!');
    console.log('📱 https://t.me/zuzim_universe_bot');
    console.log(`🎯 Mini App URL: ${MINI_APP_URL}`);
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
