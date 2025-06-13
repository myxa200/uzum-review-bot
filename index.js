const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// Загружаем переменные окружения
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME;
const HISTORY_SHEET_NAME = process.env.HISTORY_SHEET_NAME;

// Авторизация в Google Sheets через сервисный аккаунт
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// Экранирование текста
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Отправка сообщений в Telegram
async function sendTelegramMessage(message, buttons) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons }
  });
}

// Получение Bearer токена из таблицы
async function getBearer(shopId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME
  });
  const rows = res.data.values;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === shopId) {
      return `Bearer ${rows[i][1]}`;
    }
  }
  throw new Error("Bearer не найден");
}

// Ответ в Uzum API
async function replyToReview(reviewId, replyText, token) {
  await axios.post('https://api-seller.uzum.uz/api/seller/product-reviews/reply/create', {
    reviewId: Number(reviewId),
    text: replyText
  }, {
    headers: { Authorization: token }
  });
}

// Ответы в зависимости от кнопки
function getResponseText(action, lang) {
  const replies = {
    reply_ru: "Добрый день! Мы рады что вам понравилось, ждём вас снова в нашем магазине.",
    reply_uz: "Hayrli kun! Sizga yoqqanidan xursandmiz, sizni yana do'konimizda kutamiz.",
    complain_ru: "Добрый день. Свяжитесь с нами через чат (Спросить продавца), мы решим ваш вопрос.",
    complain_uz: "Xayrli kun. Bizga sotuvchining chatida yozing, biz sizning muammoingizni hal qilamiz."
  };
  return replies[`${action}_${lang}`];
}

// Webhook обработчик
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data.callback_query) return res.sendStatus(200);
    const callbackData = data.callback_query.data;
    const [action, lang, reviewId, shopId] = callbackData.split('|');

    const replyText = getResponseText(action, lang);
    const token = await getBearer(shopId);
    await replyToReview(reviewId, replyText, token);

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      callback_query_id: data.callback_query.id,
      text: "Ответ отправлен!"
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Bot is running on port', PORT);
});
