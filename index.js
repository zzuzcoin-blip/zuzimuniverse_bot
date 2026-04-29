require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { initDB, getDB } = require('./database');
const express = require('express');

// ========== ВЕБ-СЕРВЕР ДЛЯ RENDER (ОБЯЗАТЕЛЬНО ДЛЯ ПОРТА) ==========
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('ZUZ Universe Bot is running ✅');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Web server listening on port ${PORT}`);
});

// ========== БОТ ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://zuzumiverse-bot.onrender.com';

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Клавиатуры
const mainKeyboard = () => Markup.keyboard([
    ['🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ'],
    ['🏠 Главная', '💰 Мой баланс'],
    ['👥 Партнёры', '❓ Помощь']
]).resize();

const webAppButton = () => Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
]);

// Сохранение пользователя
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
                await db.run('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)', referrerId, userId);
                await ctx.reply('🎉 Вы приглашены другом! Вам будет начисляться 5% от его покупок.');
            }
        }
    }
}

// Обработчики
bot.start(async (ctx) => {
    await saveUser(ctx);
    await ctx.reply(
        `✨ *Добро пожаловать в ZUZ Universe!* ✨\n\n` +
        `⚡ *Time > Money*\n\n` +
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
        `🚀 Все действия — в Mini App.`,
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
        `💰 *Ваш баланс*\n\nZUZ: ${balanceText}\n\n📊 *Подробности — в приложении.*`,
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
        `Приглашайте друзей и получайте *5%* от их покупок!\n\n` +
        `🔗 \`${refLink}\`\n\n` +
        `📊 Партнёров: ${referrals.length}\n` +
        `💰 Заработано: ${referrals.reduce((sum, r) => sum + (r.earned_zuz || 0), 0).toLocaleString()} ZUZ`,
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
        `❓ *Помощь*\n\n` +
        `/start - перезапустить\n` +
        `/wallet - адрес кошелька\n` +
        `/referral - ссылка для друга\n\n` +
        `🔗 [Сайт](https://zuzim-universe.com) | [Twitter](https://x.com/zuzim_universe)`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
});

bot.command('wallet', async (ctx) => {
    await saveUser(ctx);
    await ctx.reply(`🔑 *Ваш кошелёк*\n\n👇 Откройте приложение:`, { parse_mode: 'Markdown', ...webAppButton() });
});

bot.command('referral', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.reply(`🔗 \`https://t.me/zuzim_universe_bot?start=ref_${userId}\``, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        await ctx.reply('🏠 *Главное меню*', { parse_mode: 'Markdown', ...mainKeyboard() });
    }
});

// Запуск бота
async function start() {
    await initDB();
    await bot.launch();
    console.log('🚀 Бот запущен');
    console.log('📱 https://t.me/zuzim_universe_bot');
}

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
