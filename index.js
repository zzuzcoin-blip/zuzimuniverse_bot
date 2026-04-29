require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');

// ========== 1. Express СЕРВЕР (обязательно для Render) ==========
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('ZUZ Universe Bot is running ✅');
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Web server listening on port ${PORT}`);
});

// ========== 2. TELEGRAM БОТ ==========
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://zuzumiverse-bot.onrender.com';

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not set');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Простые ответы для проверки
bot.start((ctx) => ctx.reply(`✨ Добро пожаловать в ZUZ Universe! ✨\n\n⚡ Time > Money\n\n👇 Открой Mini App:`, {
    ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
    ])
}));

bot.hears('🚀 ОТКРЫТЬ ПРИЛОЖЕНИЕ', (ctx) => ctx.reply(`👇 Открой ZUZ Universe:`, {
    ...Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 ОТКРЫТЬ ZUZ UNIVERSE', MINI_APP_URL)]
    ])
}));

bot.launch();
console.log('🤖 Бот запущен и слушает');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
