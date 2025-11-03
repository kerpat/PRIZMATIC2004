# 🚀 Настройка PostgreSQL на Яндекс VPS

## Шаг 1: Подключение к VPS

```bash
ssh root@your-vps-ip
```

## Шаг 2: Установка PostgreSQL 16

```bash
# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем PostgreSQL
apt install -y postgresql-16 postgresql-contrib-16 postgresql-16-postgis-3

# Проверяем установку
sudo systemctl status postgresql

# Устанавливаем дополнительные инструменты
apt install -y nginx certbot python3-certbot-nginx
```

## Шаг 3: Настройка PostgreSQL

### 3.1 Создаем базу данных и пользователя

```bash
# Переключаемся на пользователя postgres
sudo -u postgres psql

# В psql выполняем:
```

```sql
-- Создаем базу данных
CREATE DATABASE prizmatic;

-- Создаем пользователя
CREATE USER prizmatic_user WITH PASSWORD 'ваш_сильный_пароль_здесь';

-- Даем права
GRANT ALL PRIVILEGES ON DATABASE prizmatic TO prizmatic_user;

-- Переключаемся на новую базу
\c prizmatic

-- Даем права на схему
GRANT ALL ON SCHEMA public TO prizmatic_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prizmatic_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prizmatic_user;

-- Включаем расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Выходим
\q
```

### 3.2 Настраиваем удаленный доступ

```bash
# Редактируем postgresql.conf
nano /etc/postgresql/16/main/postgresql.conf
```

Найдите и измените:
```conf
listen_addresses = '*'
max_connections = 200
```

```bash
# Редактируем pg_hba.conf
nano /etc/postgresql/16/main/pg_hba.conf
```

Добавьте в конец:
```conf
# Разрешаем подключения с любого IP (используйте SSL!)
host    prizmatic    prizmatic_user    0.0.0.0/0    md5
hostssl prizmatic    prizmatic_user    0.0.0.0/0    md5
```

```bash
# Перезапускаем PostgreSQL
systemctl restart postgresql

# Проверяем, что порт 5432 открыт
netstat -tulnp | grep 5432
```

### 3.3 Настраиваем firewall

```bash
# Разрешаем порты
ufw allow 5432/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

## Шаг 4: Импорт схемы базы данных

```bash
# Копируем SQL файл на сервер
scp setup_new_database.sql root@your-vps-ip:/root/

# На сервере выполняем:
sudo -u postgres psql -d prizmatic -f /root/setup_new_database.sql
```

## Шаг 5: Настройка SSL для PostgreSQL (рекомендуется)

```bash
# Генерируем самоподписанный сертификат
cd /var/lib/postgresql/16/main/
sudo -u postgres openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key -subj "/CN=your-domain.com"
sudo -u postgres chmod 600 server.key
sudo -u postgres chmod 600 server.crt

# Включаем SSL в postgresql.conf
nano /etc/postgresql/16/main/postgresql.conf
```

Добавьте:
```conf
ssl = on
ssl_cert_file = '/var/lib/postgresql/16/main/server.crt'
ssl_key_file = '/var/lib/postgresql/16/main/server.key'
```

```bash
# Перезапускаем
systemctl restart postgresql
```

## Шаг 6: Проверка подключения

```bash
# С VPS
psql -h localhost -U prizmatic_user -d prizmatic -c "SELECT version();"

# С вашего компьютера (замените IP)
psql "postgresql://prizmatic_user:ваш_пароль@your-vps-ip:5432/prizmatic" -c "SELECT version();"
```

## Шаг 7: Настройка файлового хранилища (замена Supabase Storage)

### Вариант A: Простое хранилище на VPS

```bash
# Создаем директории для файлов
mkdir -p /var/www/prizmatic-storage/{passports,support_files,contracts}
chown -R www-data:www-data /var/www/prizmatic-storage
chmod -R 755 /var/www/prizmatic-storage
```

### Вариант B: Minio (S3-совместимое хранилище)

```bash
# Устанавливаем Minio
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
mv minio /usr/local/bin/

# Создаем пользователя
useradd -r minio -s /sbin/nologin
mkdir -p /data/minio
chown -R minio:minio /data/minio

# Создаем systemd service
cat > /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target

[Service]
User=minio
Group=minio
Environment="MINIO_ROOT_USER=admin"
Environment="MINIO_ROOT_PASSWORD=your_strong_password_here"
ExecStart=/usr/local/bin/minio server /data/minio --console-address ":9001"
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# Запускаем Minio
systemctl daemon-reload
systemctl enable minio
systemctl start minio

# Проверяем
systemctl status minio
```

Minio будет доступен:
- API: http://your-vps-ip:9000
- Console: http://your-vps-ip:9001

## Шаг 8: Настройка Nginx (API + Storage)

```bash
# Создаем конфиг для Nginx
nano /etc/nginx/sites-available/prizmatic
```

```nginx
server {
    listen 80;
    server_name your-domain.com api.your-domain.com;

    client_max_body_size 50M;

    # Storage API
    location /storage/ {
        alias /var/www/prizmatic-storage/;
        autoindex off;
        
        # Только через API
        internal;
    }

    # Прокси к вашему API серверу (Vercel или локальный)
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Если используете Minio
    location /minio/ {
        proxy_pass http://localhost:9000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Включаем сайт
ln -s /etc/nginx/sites-available/prizmatic /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Настраиваем SSL через Let's Encrypt
certbot --nginx -d your-domain.com -d api.your-domain.com
```

## Шаг 9: Бэкапы базы данных

```bash
# Создаем скрипт бэкапа
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Бэкап базы
pg_dump -U prizmatic_user -h localhost prizmatic | gzip > $BACKUP_DIR/prizmatic_$DATE.sql.gz

# Бэкап файлов
tar -czf $BACKUP_DIR/storage_$DATE.tar.gz /var/www/prizmatic-storage/

# Удаляем старые бэкапы (старше 7 дней)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /root/backup-db.sh

# Добавляем в cron (каждый день в 3:00)
crontab -e
```

Добавьте:
```cron
0 3 * * * /root/backup-db.sh >> /var/log/backup.log 2>&1
```

## Шаг 10: Мониторинг

```bash
# Установка pgAdmin (опционально)
# Или используйте DBeaver/TablePlus с вашего компьютера

# Мониторинг логов
tail -f /var/log/postgresql/postgresql-16-main.log

# Проверка активных подключений
sudo -u postgres psql -d prizmatic -c "SELECT * FROM pg_stat_activity;"
```

## Строка подключения

После настройки ваша строка подключения:

```bash
# Без SSL
postgresql://prizmatic_user:ваш_пароль@your-vps-ip:5432/prizmatic

# С SSL
postgresql://prizmatic_user:ваш_пароль@your-vps-ip:5432/prizmatic?sslmode=require
```

## Переменные окружения для приложения

```bash
# PostgreSQL
DATABASE_URL=postgresql://prizmatic_user:ваш_пароль@your-vps-ip:5432/prizmatic
DB_HOST=your-vps-ip
DB_PORT=5432
DB_NAME=prizmatic
DB_USER=prizmatic_user
DB_PASSWORD=ваш_пароль

# Storage (если используете простое хранилище)
STORAGE_URL=https://your-domain.com/storage
STORAGE_PATH=/var/www/prizmatic-storage

# Storage (если используете Minio)
MINIO_ENDPOINT=your-vps-ip:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=your_strong_password_here
MINIO_USE_SSL=false
```

## Безопасность ⚠️

1. **Измените пароль PostgreSQL** на сильный
2. **Настройте SSL** для PostgreSQL
3. **Ограничьте доступ** в pg_hba.conf (укажите конкретные IP)
4. **Настройте firewall** правильно
5. **Включите fail2ban** для защиты от brute-force
6. **Регулярные бэкапы**
7. **Мониторинг логов**

```bash
# Установка fail2ban
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

## Проверка после настройки

```sql
-- Подключитесь к базе и проверьте:
\dt          -- Список таблиц
\df          -- Список функций
\di          -- Список индексов

SELECT COUNT(*) FROM clients;
SELECT COUNT(*) FROM tariffs;
SELECT COUNT(*) FROM bikes;
```

---

**Готово! VPS настроен и готов к работе** 🎉

