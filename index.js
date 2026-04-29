require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const db = require('./database');

// === Express сервер для Render (обязательно!) ===
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('ZUZ Universe Bot ✅'));
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Web server on port ${PORT}`));

// === Бот ===
const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL;

// Функция создания/обновления пользователя
function ensureUser(userId, referrerId = null) {
    const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (user_id, referrer_id) VALUES (?, ?)').run(userId, referrerId);
        if (referrerId) {
            db.prepare('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)').run(referrerId, userId);
        }
    }
}

// === Обработчики ===
bot.start(async (ctx) => {
    const ref = ctx.message.text.split(' ')[1]?.replace('ref_', '');
    ensureUser(ctx.from.id, ref ? parseInt(ref) : null);
    
    await ctx.replyWithHTML(
        `✨ <b>Добро пожаловать в ZUZ Universe!</b> ✨\n\n` +
        `⚡ <i>Time > Money</i>\n\n` +
        `👇 Открой Mini App, чтобы управлять токенами:`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
        ])
    );
});

// === Главное меню ===
bot.hears('🏠 Главная', async (ctx) => {
    await ctx.replyWithHTML(
        `<b>🏛️ ZUZ UNIVERSE</b>\n\n` +
        `📜 Путь 7 мудрецов\n` +
        `💰 Чем больше ZUZ — тем выше ранг\n` +
        `🎁 Бонус к стейкингу до +30%\n\n` +
        `👉 Все действия в Mini App: покупка, стейкинг, реварды, партнёры.`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ', MINI_APP_URL)]
        ])
    );
});

bot.hears('💰 Мой баланс', async (ctx) => {
    const user = db.prepare('SELECT balance, staked FROM users WHERE user_id = ?').get(ctx.from.id);
    const balance = user?.balance || 0;
    const staked = user?.staked || 0;
    
    await ctx.replyWithHTML(
        `<b>💰 Твой баланс</b>\n\n` +
        `ZUZ: ${balance.toLocaleString()}\n` +
        `В стейкинге: ${staked.toLocaleString()}\n\n` +
        `📊 Подробности — в Mini App.`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('🔍 ПЕРЕЙТИ', MINI_APP_URL)]
        ])
    );
});

bot.hears('👥 Партнёры', async (ctx) => {
    const userId = ctx.from.id;
    const refLink = `https://t.me/zuzim_universe_bot?start=ref_${userId}`;
    const referrals = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?').get(userId);
    const earned = db.prepare('SELECT SUM(earned) as total FROM referrals WHERE referrer_id = ?').get(userId);
    
    await ctx.replyWithHTML(
        `<b>👥 Партнёрская программа</b>\n\n` +
        `🔗 Твоя ссылка:\n<code>${refLink}</code>\n\n` +
        `📊 Приглашено: ${referrals.count}\n` +
        `💰 Заработано: ${(earned.total || 0).toLocaleString()} ZUZ\n\n` +
        `🎯 5% от покупок твоих друзей — твои!`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📋 КОПИРОВАТЬ ССЫЛКУ', 'copy_ref')]
        ])
    );
});

bot.action('copy_ref', async (ctx) => {
    const refLink = `https://t.me/zuzim_universe_bot?start=ref_${ctx.from.id}`;
    await ctx.answerCbQuery();
    await ctx.reply(`🔗 <code>${refLink}</code>`, { parse_mode: 'HTML' });
});

bot.hears('❓ Помощь', async (ctx) => {
    await ctx.replyWithHTML(
        `<b>❓ Помощь</b>\n\n` +
        `/start — перезапустить\n` +
        `/wallet — адрес кошелька\n` +
        `/referral — ссылка для друга\n\n` +
        `🔗 <a href="https://zuzim-universe.com">Сайт</a> | <a href="https://x.com/zuzim_universe">Twitter</a>`
    );
});

bot.command('wallet', async (ctx) => {
    const user = db.prepare('SELECT wallet FROM users WHERE user_id = ?').get(ctx.from.id);
    await ctx.reply(`🔑 Ваш кошелёк:\n<code>${user?.wallet || 'не подключён'}</code>\n\n👇 Открой Mini App, чтобы подключить или сменить кошелёк.`, { parse_mode: 'HTML' });
});

bot.command('referral', async (ctx) => {
    const refLink = `https://t.me/zuzim_universe_bot?start=ref_${ctx.from.id}`;
    await ctx.reply(`🔗 <code>${refLink}</code>`, { parse_mode: 'HTML' });
});

// === Клавиатура (при любом тексте) ===
const mainKeyboard = () => Markup.keyboard([
    ['🏠 Главная', '💰 Мой баланс'],
    ['👥 Партнёры', '❓ Помощь']
]).resize();

bot.on('text', (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        ctx.reply('🏠 Меню:', mainKeyboard());
    }
});

bot.launch();
console.log('🚀 Бот ZUZ Universe запущен');
