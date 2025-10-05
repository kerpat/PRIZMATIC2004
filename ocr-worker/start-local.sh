#!/bin/bash

# Скрипт для локального запуска OCR воркера
echo "🚀 Запуск OCR Worker локально..."
echo "📋 Проверка зависимостей..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Скачайте с https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен."
    exit 1
fi

echo "✅ Node.js найден: $(node -v)"
echo "✅ npm найден: $(npm -v)"

# Установка зависимостей
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Проверка .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "📝 Скопируйте .env.example в .env и заполните реальными значениями"
    exit 1
fi

echo "🔧 Проверка переменных окружения..."
node -e "
require('dotenv').config();
const checks = [
  ['SUPABASE_URL', process.env.SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ['SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY],
  ['TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN],
  ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
  ['INTERNAL_SECRET', process.env.INTERNAL_SECRET]
];

checks.forEach(([key, value]) => {
  console.log(\`\${value ? '✅' : '❌'} \${key}\`);
});

const missing = checks.filter(([, value]) => !value);
if (missing.length > 0) {
  console.log('\\n❌ Отсутствуют переменные окружения:');
  missing.forEach(([key]) => console.log(\`   - \${key}\`));
  process.exit(1);
}
"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎯 Запуск сервера..."
    echo "🌐 После запуска сервер будет доступен на http://localhost:3000"
    echo "🔗 Для тестирования используйте ngrok: ngrok http 3000"
    echo ""
    npm start
else
    echo "❌ Ошибка проверки переменных окружения"
    exit 1
fi