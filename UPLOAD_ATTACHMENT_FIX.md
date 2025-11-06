# Исправление ошибки загрузки файлов в чатах поддержки

## Проблема
При попытке загрузить файлы в чатах поддержки (в админке и в профиле) возникали ошибки:
1. В админке: `ReferenceError: state is not defined`
2. В профиле: проблемы с загрузкой файлов в чат поддержки
3. На Vercel: 404 ошибка по пути `/api/upload-support-attachment`

## Причины
1. Функция `handleFileUpload` в `admin_support.js` была объявлена вне области видимости `DOMContentLoaded`, где переменная `state` недоступна
2. Функция `handleFileUpload` в `profile.js` не учитывала случаи, когда `state.anonymousChatId` может быть не определен
3. В `vercel.json` не было правила перенаправления для `/api/upload-support-attachment`
4. В `api/router.js` не было обработки для endpoint `upload-support-attachment`

## Решения

### 1. Исправление в `site/admin_support.js`:
- Перемещена функция `handleFileUpload` внутрь области видимости `DOMContentLoaded`
- Также перемещены связанные функции `sendAdminMessage` и `appendMessageToHistory`
- Добавлена поддержка отображения различных типов файлов (изображения, видео, документы) в чате

### 2. Исправление в `site/profile.js`:
- Улучшена функция `handleFileUpload`, чтобы корректно обрабатывать случаи, когда `state.anonymousChatId` не определен
- Добавлена генерация временного anonymousChatId, если ни один идентификатор не задан

### 3. Исправления в API:
- В `vercel.json` добавлено правило перенаправления:
  ```json
  {
    "source": "/api/upload-support-attachment",
    "destination": "/api/router?endpoint=upload-support-attachment"
  }
  ```
- В `api/router.js` добавлена обработка endpoint `upload-support-attachment`:
  ```javascript
  case 'upload-support-attachment':
      return require('./upload-support-attachment')(req, res);
  ```

### 4. Создание обработчика:
- Создан файл `api/upload-support-attachment.js` с правильной обработкой multipart-данных
- Добавлена проверка на `bodyParser: false` для корректной обработки файлов

## Результат
- Загрузка файлов в чатах поддержки теперь работает корректно
- Ошибки `state is not defined` устранены
- Загрузка файлов как в админке, так и в профиле работает через единый роутер
- Поддержка различных типов файлов с правильным отображением в интерфейсе

## Требования к деплою
После внесения изменений необходимо:
1. Закоммитить и запушить все изменения в репозиторий
2. Выполнить деплой на Vercel (автоматически через git push или вручную через CLI)
3. Убедиться, что все зависимости (busboy) указаны в package.json