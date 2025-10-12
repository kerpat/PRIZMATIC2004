#!/usr/bin/env node

// Тестовый скрипт для проверки OCR воркера
require('dotenv').config();
const axios = require('axios');

const TEST_USER_ID = 'test-user-123';
const TEST_FILE_IDS = [
  {
    field: 'ru_passport_main',
    file_id: 'test_file_id_1',
    file_unique_id: 'test_unique_1'
  }
];

async function testWorker() {
  const workerUrl = process.env.OCR_WORKER_URL || 'http://localhost:3000';
  const internalSecret = process.env.INTERNAL_SECRET;

  if (!internalSecret) {
    console.error('❌ INTERNAL_SECRET не найден в .env');
    process.exit(1);
  }

  console.log('🧪 Тестирование OCR воркера...');
  console.log(`🌐 URL воркера: ${workerUrl}`);
  console.log(`👤 Test User ID: ${TEST_USER_ID}`);
  console.log(`📄 Test Files: ${TEST_FILE_IDS.length}`);

  try {
    const response = await axios.post(`${workerUrl}/process-document`, {
      userId: TEST_USER_ID,
      fileIds: TEST_FILE_IDS
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret
      },
      timeout: 30000
    });

    console.log('✅ Тест успешен!');
    console.log('📋 Ответ сервера:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Тест провалился:');
    if (error.response) {
      console.error(`📊 Статус: ${error.response.status}`);
      console.error('📋 Ответ сервера:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Сервер не запущен или недоступен');
      console.error('💡 Запустите: npm start');
    } else {
      console.error('🔍 Ошибка:', error.message);
    }
  }
}

// Запуск теста
if (require.main === module) {
  testWorker();
}

module.exports = { testWorker };