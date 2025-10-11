# Database Setup Guide

## Проблема: База данных очищается при перезапуске

**Симптомы:**
- Поиск поставщиков не сохраняется
- Таблица результатов пустая после перезапуска сервера
- Ошибка: `column "search_id" does not exist`

**Причина:**
Приложение использует **pg-mem** (in-memory database) когда `DATABASE_URL` не настроен в `.env` файле. Это означает что все данные хранятся в памяти и теряются при каждом перезапуске.

---

## Решение: Настройка PostgreSQL для локальной разработки

### Вариант 1: Docker (рекомендуется) ✅

**Шаг 1: Запустить PostgreSQL через Docker**

```bash
# Запустить базу данных (автоматически скачает образ при первом запуске)
cd D:\Automation\Development\projects\suppler-serch
scripts\db-setup.bat
```

Скрипт автоматически:
1. Поднимет PostgreSQL контейнер
2. Применит все миграции (001, 002, 003)
3. База будет готова к работе

**Шаг 2: Обновить .env файл**

Скопируйте `.env.local.example` в `.env`:

```bash
copy .env.local.example .env
```

Или добавьте в существующий `.env`:

```env
# Database connection (Local PostgreSQL)
DATABASE_URL=postgresql://supplier_admin:dev_password_change_in_prod@localhost:5432/supplier_search
PGSSL=false
```

**Шаг 3: Перезапустить приложение**

```bash
npm start
```

Теперь данные **сохраняются между перезапусками** ✅

---

### Вариант 2: Railway или Supabase (production)

Для production используйте облачную базу данных:

**Railway:**
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST].railway.app:5432/railway
PGSSL=true
```

**Supabase:**
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
PGSSL=true
```

---

## Управление базой данных

### Подключение к БД

**pgAdmin / DBeaver / psql:**
```
Host: localhost
Port: 5432
Database: supplier_search
User: supplier_admin
Password: dev_password_change_in_prod
```

### Полезные команды

```bash
# Запустить БД
docker-compose up -d

# Остановить БД
docker-compose down

# Посмотреть логи БД
docker-compose logs -f postgres

# Применить миграции вручную
node src/db/migrate.js

# Очистить БД и начать заново (УДАЛИТ ВСЕ ДАННЫЕ!)
docker-compose down -v
docker-compose up -d
node src/db/migrate.js
```

---

## Миграции базы данных

Приложение поддерживает автоматические миграции:

| Миграция | Описание |
|----------|----------|
| `001_initial_schema.sql` | Базовая схема (searches, suppliers, email_sends) |
| `002_add_search_fields.sql` | Добавляет поля: search_id, product_description, target_price, и другие |
| `003_add_performance_indexes.sql` | Performance оптимизации для production |

Миграции применяются автоматически при первом запросе к БД или вручную через `node src/db/migrate.js`.

---

## Диагностика проблем

### Проверка: Какая БД используется?

Запустите приложение и посмотрите на первую строку логов:

```
❌ Using in-memory pg-mem database - data will be lost after restart
   → Проблема: DATABASE_URL не настроен

✅ PostgreSQL pool created
   → OK: Используется настоящая PostgreSQL база
```

### Проверка: Применены ли миграции?

```bash
node -e "import('./src/db/migrate.js').then(m => m.getMigrationStatus()).then(console.log)"
```

Ожидаемый вывод:
```json
{
  "total": 3,
  "applied": 3,
  "pending": 0,
  "appliedList": [
    "001_initial_schema.sql",
    "002_add_search_fields.sql",
    "003_add_performance_indexes.sql"
  ]
}
```

---

## FAQ

**Q: Нужно ли устанавливать PostgreSQL локально?**
A: Нет, если используете Docker. Образ PostgreSQL скачается автоматически.

**Q: Могу ли я использовать SQLite?**
A: Нет, приложение поддерживает только PostgreSQL (pg-mem для dev или настоящую PostgreSQL).

**Q: Как мигрировать данные из pg-mem в PostgreSQL?**
A: Данные из pg-mem не сохраняются и потеряны при перезапуске. Начните с чистой PostgreSQL базы.

**Q: Безопасно ли использовать пароль из docker-compose.yml?**
A: Только для локальной разработки! Для production обязательно измените credentials.

---

## Production Deployment (Railway)

Приложение уже развернуто на Railway с production PostgreSQL базой.

**При деплое убедитесь что:**
1. `DATABASE_URL` настроен в Railway environment variables
2. Миграции применены автоматически при первом запуске
3. SSL включен (`PGSSL=true` или в connection string `?sslmode=require`)

---

## Архитектура базы данных

```
┌─────────────────┐
│    searches     │  ← Основная таблица поисков
├─────────────────┤
│ id              │
│ search_id       │  ← UUID для API
│ product_desc    │
│ target_price    │
│ quantity        │
│ ...             │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│   suppliers     │  ← Найденные поставщики
├─────────────────┤
│ id              │
│ search_id (FK)  │
│ company_name    │
│ email           │
│ ...             │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐
│  email_sends    │  ← История отправки писем
├─────────────────┤
│ id              │
│ supplier_id(FK) │
│ status          │
│ sent_at         │
└─────────────────┘
```

---

## Поддержка

Если возникли проблемы с настройкой базы данных:
1. Проверьте что Docker запущен (`docker info`)
2. Проверьте логи контейнера (`docker-compose logs postgres`)
3. Проверьте что порт 5432 не занят другим процессом

**Создано:** 2025-10-11
**Обновлено:** После исправления критического бага с очисткой БД
