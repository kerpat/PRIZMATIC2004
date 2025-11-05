# Инструкция по запуску WebSocket сервера на VPS

## Подключение к VPS
```bash
ssh -l kerpat 51.250.17.150
```

## Установка Node.js (если не установлен)
```bash
# Обновление пакетов
sudo apt update

# Установка Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка установки
node --version
npm --version
```

## Установка и запуск WebSocket сервера

1. Скопируйте файлы на VPS:
   - vps-websocket-server.js
   - vps-package.json (переименуйте в package.json)
   - vps-.env (переименуйте в .env)

2. Установка зависимостей:
```bash
npm install
```

3. Настройка .env файла:
```bash
# Генерация секретного ключа
INTERNAL_SECRET=$(openssl rand -hex 32)
echo "INTERNAL_SECRET=$INTERNAL_SECRET" > .env
echo "WS_PORT=8080" >> .env
```

4. Запуск сервера:
```bash
npm start
```

## Настройка автозапуска с PM2 (рекомендуется)

1. Установка PM2:
```bash
npm install -g pm2
```

2. Запуск сервера с автозапуском:
```bash
pm2 start vps-websocket-server.js --name "prizmatic-ws"
pm2 startup
pm2 save
```

## Открытие порта
Если используется ufw:
```bash
sudo ufw allow 8080
```

## Проверка работы
- WebSocket: ws://51.250.17.150:8080
- API уведомлений: http://51.250.17.150:8080/api/notify
- Статус: http://51.250.17.150:8080/health
- Статистика: http://51.250.17.150:8080/stats