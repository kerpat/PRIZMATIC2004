# 🔄 Миграция с Supabase на VPS PostgreSQL

## Что изменится

- ❌ **Убираем**: Supabase клиент (@supabase/supabase-js)
- ✅ **Добавляем**: Прямое подключение к PostgreSQL (pg)
- ✅ **Добавляем**: Собственный API для загрузки файлов
- ✅ **Добавляем**: Minio или файловую систему для хранения

---

## Шаг 1: Установка зависимостей

### Backend (API)

```bash
cd api
npm install pg minio formidable
```

### Обновите package.json:

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "minio": "^7.1.3",
    "formidable": "^3.5.1"
  }
}
```

---

## Шаг 2: Настройка переменных окружения

### Vercel Environment Variables

Обновите в Dashboard → Settings → Environment Variables:

```bash
# PostgreSQL (VPS)
DB_HOST=your-vps-ip
DB_PORT=5432
DB_NAME=prizmatic
DB_USER=prizmatic_user
DB_PASSWORD=ваш_сильный_пароль
DB_SSL=true

# Storage (Filesystem)
STORAGE_TYPE=filesystem
STORAGE_PATH=/var/www/prizmatic-storage
STORAGE_URL=https://your-domain.com/storage

# Или Storage (Minio)
STORAGE_TYPE=minio
MINIO_ENDPOINT=your-vps-ip
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=ваш_пароль
MINIO_USE_SSL=false

# Остальные как были
GOOGLE_API_KEY=...
GEMINI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
BOT_NOTIFY_URL=...
OCR_WORKER_URL=...
ADMIN_SECRET_KEY=...
INTERNAL_SECRET=...
CONTRACTS_API_URL=...
```

**Нажмите Redeploy после обновления!**

---

## Шаг 3: Обновление API файлов

### Замените Supabase клиент на прямое подключение

**Было (с Supabase):**
```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('clients')
  .select('*')
  .eq('id', userId)
  .single();
```

**Стало (с прямым PostgreSQL):**
```javascript
const db = require('../lib/db-direct');

const { data, error } = await db.from('clients')
  .select('*')
  .eq('id', userId)
  .single()
  .execute();
```

### Обновите api/_lib_data.js

```javascript
// В начале файла замените:
// const { createClient } = require('@supabase/supabase-js');
// const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// На:
const db = require('../lib/db-direct');
```

### Обновите api/_lib_auth.js

Аналогично замените все вызовы `supabase.from()` на `db.from()`.

### Обновите api/_lib_payments.js

```javascript
const db = require('../lib/db-direct');

// Пример использования
async function getClientPaymentMethod(clientId) {
  const { data, error } = await db.from('clients')
    .select('yookassa_payment_method_id')
    .eq('id', clientId)
    .single()
    .execute();
    
  return data;
}
```

---

## Шаг 4: Обновление Storage API

### Добавьте новые endpoints в api/router.js

```javascript
// В начале файла добавьте:
const storageUploadHandler = require('./storage-upload');
const storageDownloadHandler = require('./storage-download');

// В switch добавьте новые кейсы:
switch (endpoint) {
  // ... существующие endpoints ...
  
  case 'storage-upload':
    return storageUploadHandler(req, res);
  
  case 'storage-download':
    return storageDownloadHandler(req, res);
  
  // ...
}
```

---

## Шаг 5: Обновление Frontend (site/)

### Создайте новый файл site/db-api.js

```javascript
/**
 * API клиент для работы с VPS базой данных
 * Замена Supabase клиента
 */

const API_URL = window.CONFIG?.API_URL || '/api/router';

class DatabaseClient {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  from(table) {
    return new QueryBuilder(table, this.apiUrl);
  }

  async rpc(functionName, params) {
    const response = await fetch(`${this.apiUrl}?endpoint=data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rpc',
        function: functionName,
        params: params
      })
    });
    return await response.json();
  }

  storage = {
    from: (bucket) => ({
      upload: async (path, file, options = {}) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucket);
        formData.append('path', path);
        
        const response = await fetch(`${API_URL}?endpoint=storage-upload`, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        return { data: result.success ? { path: result.publicUrl } : null, error: result.error };
      },
      
      download: async (path) => {
        const response = await fetch(
          `${API_URL}?endpoint=storage-download&bucket=${bucket}&path=${path}`
        );
        const blob = await response.blob();
        return { data: blob, error: null };
      },
      
      getPublicUrl: (path) => {
        return {
          data: {
            publicUrl: `${API_URL}?endpoint=storage-download&bucket=${bucket}&path=${path}`
          }
        };
      }
    })
  };
}

class QueryBuilder {
  constructor(table, apiUrl) {
    this.table = table;
    this.apiUrl = apiUrl;
    this.selectFields = '*';
    this.filters = [];
    this.orderBy = null;
    this.limitValue = null;
    this.offsetValue = null;
    this.isSingleRow = false;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  neq(field, value) {
    this.filters.push({ field, operator: 'neq', value });
    return this;
  }

  gt(field, value) {
    this.filters.push({ field, operator: 'gt', value });
    return this;
  }

  gte(field, value) {
    this.filters.push({ field, operator: 'gte', value });
    return this;
  }

  lt(field, value) {
    this.filters.push({ field, operator: 'lt', value });
    return this;
  }

  lte(field, value) {
    this.filters.push({ field, operator: 'lte', value });
    return this;
  }

  like(field, pattern) {
    this.filters.push({ field, operator: 'like', value: pattern });
    return this;
  }

  ilike(field, pattern) {
    this.filters.push({ field, operator: 'ilike', value: pattern });
    return this;
  }

  in(field, values) {
    this.filters.push({ field, operator: 'in', value: values });
    return this;
  }

  is(field, value) {
    this.filters.push({ field, operator: 'is', value });
    return this;
  }

  order(field, direction = 'asc') {
    this.orderBy = { field, direction };
    return this;
  }

  limit(count) {
    this.limitValue = count;
    return this;
  }

  range(from, to) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  single() {
    this.isSingleRow = true;
    this.limitValue = 1;
    return this;
  }

  async insert(data) {
    const response = await fetch(`${this.apiUrl}?endpoint=data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'insert',
        table: this.table,
        data: data
      })
    });
    return await response.json();
  }

  async update(data) {
    const response = await fetch(`${this.apiUrl}?endpoint=data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        table: this.table,
        data: data,
        filters: this.filters
      })
    });
    return await response.json();
  }

  async delete() {
    const response = await fetch(`${this.apiUrl}?endpoint=data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        table: this.table,
        filters: this.filters
      })
    });
    return await response.json();
  }

  async execute() {
    const response = await fetch(`${this.apiUrl}?endpoint=data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'select',
        table: this.table,
        select: this.selectFields,
        filters: this.filters,
        order: this.orderBy,
        limit: this.limitValue,
        offset: this.offsetValue,
        single: this.isSingleRow
      })
    });
    
    const result = await response.json();
    return result;
  }

  // Алиасы для совместимости с Supabase
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

// Создаем глобальный экземпляр
window.dbClient = new DatabaseClient(API_URL);
```

### Обновите site/index.html и другие страницы

```html
<!-- Было -->
<script src="supabase.min.js"></script>
<script>
const supabase = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);
</script>

<!-- Стало -->
<script src="db-api.js"></script>
<script>
// Используйте window.dbClient вместо supabase
const { data, error } = await window.dbClient
  .from('clients')
  .select('*')
  .eq('id', userId)
  .single();
</script>
```

---

## Шаг 6: Обновление Telegram Bot

В `bot.py`:

```python
# Было
from supabase import create_client, Client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Стало
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT', 5432),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        sslmode='require' if os.getenv('DB_SSL') == 'true' else 'prefer'
    )

# Пример использования
conn = get_db_connection()
cursor = conn.cursor(cursor_factory=RealDictCursor)
cursor.execute("SELECT * FROM clients WHERE id = %s", (user_id,))
user = cursor.fetchone()
cursor.close()
conn.close()
```

Или создайте wrapper:

```python
# lib/db.py
import psycopg2
from psycopg2.extras import RealDictCursor
import os

class Database:
    def __init__(self):
        self.conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT', 5432),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD')
        )
    
    def from_table(self, table):
        return QueryBuilder(table, self.conn)
    
    def close(self):
        self.conn.close()

class QueryBuilder:
    def __init__(self, table, conn):
        self.table = table
        self.conn = conn
        self.where_conditions = []
        self.params = []
        
    def select(self, fields='*'):
        self.select_fields = fields
        return self
    
    def eq(self, field, value):
        self.where_conditions.append(f"{field} = %s")
        self.params.append(value)
        return self
    
    def execute(self):
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        where = f"WHERE {' AND '.join(self.where_conditions)}" if self.where_conditions else ""
        query = f"SELECT {self.select_fields} FROM {self.table} {where}"
        cursor.execute(query, self.params)
        result = cursor.fetchall()
        cursor.close()
        return result

# Использование
db = Database()
users = db.from_table('clients').select('*').eq('verification_status', 'pending').execute()
```

---

## Шаг 7: Обновление OCR Worker

В `ocr-worker/server.js`:

```javascript
// Замените
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// На
const db = require('../lib/db-direct');
```

И обновите все запросы аналогично.

---

## Шаг 8: Тестирование

### Чеклист проверки:

- [ ] PostgreSQL доступен с VPS и извне
- [ ] База данных создана и наполнена
- [ ] API endpoints отвечают корректно
- [ ] Загрузка файлов работает
- [ ] Скачивание файлов работает
- [ ] Frontend загружается без ошибок
- [ ] Авторизация работает
- [ ] Регистрация через Telegram Bot работает
- [ ] OCR обработка документов работает
- [ ] Админ-панель функционирует

### Тестовые запросы:

```bash
# Проверка PostgreSQL
psql "postgresql://prizmatic_user:password@your-vps-ip:5432/prizmatic" -c "SELECT COUNT(*) FROM clients;"

# Проверка API
curl https://your-domain.com/api/router?endpoint=data \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"select","table":"tariffs","select":"*","filters":[]}'

# Проверка загрузки файла
curl https://your-domain.com/api/router?endpoint=storage-upload \
  -F "file=@test.jpg" \
  -F "bucket=passports" \
  -F "userId=test123"
```

---

## Rollback (если что-то пошло не так)

1. Верните старые env vars на Vercel (Supabase URL/KEY)
2. Redeploy Vercel
3. Перезапустите все сервисы с старыми настройками

---

## Преимущества VPS

✅ **Полный контроль** над базой данных  
✅ **Без лимитов** на запросы и размер базы  
✅ **Быстрее** (нет прокси через Supabase)  
✅ **Дешевле** на большом объеме  
✅ **Гибкость** в настройках и расширениях  
✅ **Свой Storage** без лимитов  

---

**Время миграции**: 2-4 часа  
**Сложность**: ⭐⭐⭐ Средняя

Удачи! 🚀

