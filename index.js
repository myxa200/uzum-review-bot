const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const config = require('./config');

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Бот успешно запущен и работает.");
});