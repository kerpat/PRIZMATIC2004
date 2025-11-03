# 🔧 Новые переменные окружения для Vercel

## Что нужно сделать в Vercel Dashboard

1. Откройте: https://vercel.com/your-project/settings/environment-variables
2. **УДАЛИТЕ** старые переменные (если есть):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **ДОБАВЬТЕ** новые переменные:

---

## 📊 PostgreSQL (VPS)

```
DB_HOST
51.250.17.150
```

```
DB_PORT
5432
```

```
DB_NAME
prizmatic
```

```
DB_USER
prizmatic_user
```

```
DB_PASSWORD
ln2+1fSbrciaIavThI+w2S/0+BQufhiMUmUU9g1CDeQ=
```

```
DB_SSL
false
```

```
DATABASE_URL
postgresql://prizmatic_user:ln2+1fSbrciaIavThI+w2S/0+BQufhiMUmUU9g1CDeQ=@51.250.17.150:5432/prizmatic
```

---

## 📦 Minio Storage

```
STORAGE_TYPE
minio
```

```
MINIO_ENDPOINT
51.250.17.150
```

```
MINIO_PORT
9000
```

```
MINIO_ACCESS_KEY
prizmatic
```

```
MINIO_SECRET_KEY
OVEWUZGHAlUtLqGe+d4qnYbRZtC6+E7kaKFp2TCqsAE=
```

```
MINIO_USE_SSL
false
```

```
STORAGE_URL
http://51.250.17.150:9000
```

---

## ✅ Оставьте БЕЗ ИЗМЕНЕНИЙ

Эти переменные остаются как есть:

- ✅ `SMS_RU_API_ID`
- ✅ `GEMINI_API_KEY`
- ✅ `GOOGLE_API_KEY`
- ✅ `TELEGRAM_BOT_TOKEN`
- ✅ `YOOKASSA_SHOP_ID`
- ✅ `YOOKASSA_SECRET_KEY`
- ✅ `BOT_NOTIFY_URL`
- ✅ `OCR_WORKER_URL`
- ✅ `ADMIN_SECRET_KEY`
- ✅ `INTERNAL_SECRET`

---

## 🚀 После добавления всех переменных

**ОБЯЗАТЕЛЬНО нажмите "Redeploy"!**

Settings → Deployments → ... → Redeploy

---

## 📋 Полный список новых переменных (копировать в Vercel)

Для удобства - все переменные одним списком:

```
DB_HOST=51.250.17.150
DB_PORT=5432
DB_NAME=prizmatic
DB_USER=prizmatic_user
DB_PASSWORD=ln2+1fSbrciaIavThI+w2S/0+BQufhiMUmUU9g1CDeQ=
DB_SSL=false
DATABASE_URL=postgresql://prizmatic_user:ln2+1fSbrciaIavThI+w2S/0+BQufhiMUmUU9g1CDeQ=@51.250.17.150:5432/prizmatic
STORAGE_TYPE=minio
MINIO_ENDPOINT=51.250.17.150
MINIO_PORT=9000
MINIO_ACCESS_KEY=prizmatic
MINIO_SECRET_KEY=OVEWUZGHAlUtLqGe+d4qnYbRZtC6+E7kaKFp2TCqsAE=
MINIO_USE_SSL=false
STORAGE_URL=http://51.250.17.150:9000
```

---

## ⚠️ Важно

1. Все переменные добавляйте для **All Environments** (Production, Preview, Development)
2. После добавления **обязательно сделайте Redeploy**
3. Проверьте что приложение работает после деплоя
4. Если что-то пошло не так - можно вернуть старые переменные из файла `VERCEL_BACKUP.env`

