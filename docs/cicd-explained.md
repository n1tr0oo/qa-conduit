# CI/CD Pipeline — Полное объяснение
## Файл: `.github/workflows/tests.yml`

---

## Что это и зачем

**GitHub Actions** — это CI/CD система встроенная в GitHub. При каждом `git push` или `pull request` в ветку `main` GitHub автоматически запускает пайплайн на своих серверах (ubuntu-latest). Это означает, что тесты прогоняются без твоего участия — ты пушишь код, GitHub сам поднимает окружение, запускает приложение, гоняет тесты и показывает результат.

**Зачем нужен CI/CD:**
- Защита ветки `main` от сломанного кода
- Автоматический прогон всех тестов при каждом изменении
- Публикация отчётов прямо в интерфейсе GitHub
- Блокировка merge если хотя бы один тест упал

---

## Триггеры

```yaml
on:
  push:
    branches: [main]      # при каждом пуше в main
  pull_request:
    branches: [main]      # при открытии/обновлении PR в main
```

---

## Структура — 4 независимых Job-а

```
push/PR → main
│
├── unit-tests   ─────────────────────────┐
├── api-tests    ─────────────────────────┤  параллельно
└── e2e-tests    ─────────────────────────┘
                                          │
                                    quality-gate  ← ждёт всех трёх
```

`unit-tests`, `api-tests`, `e2e-tests` — запускаются **параллельно** на трёх отдельных виртуальных машинах.
`quality-gate` — запускается **после всех трёх** (`needs: [unit-tests, api-tests, e2e-tests]`), собирает результаты.

---

## JOB 1 — `unit-tests`

**Назначение:** логические тесты без сети и БД. Самый быстрый job (~10 сек).

**Что делает:**
1. Скачивает репозиторий (`actions/checkout@v4`)
2. Устанавливает Node.js 20
3. Устанавливает зависимости QA (`npm install`)
4. Запускает `node --test tests/unit/*.test.mjs`

**Почему нет БД и приложения:**
Unit тесты проверяют чистую функцию `slugify()` — она не обращается к сети или БД. Тест работает в изоляции.

**Ключевой шаг:**
```yaml
- name: Run unit tests
  run: node --test tests/unit/*.test.mjs
```
`node --test` — встроенный test runner Node.js 20, никакой сторонней библиотеки.

---

## JOB 2 — `api-tests`

**Назначение:** интеграционные тесты API через Newman (Postman CLI). Проверяет что HTTP-контракт между фронтом и бэком соблюдается.

**Инфраструктура:** нужен только **бэкенд** (порт 3001) + **PostgreSQL**. Фронтенд не нужен.

### Сервис PostgreSQL
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_USER: conduit
      POSTGRES_PASSWORD: conduit
      POSTGRES_DB: conduit_ci
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready     # ждёт пока БД готова принимать запросы
      --health-interval 10s
      --health-retries 5
```
PostgreSQL запускается как Docker-контейнер рядом с job-ом. Он эфемерный — умирает вместе с job-ом, данные не сохраняются между запусками.

### Шаги по порядку:
| # | Шаг | Зачем |
|---|---|---|
| 1 | `actions/checkout@v4` | Скачать QA-репо |
| 2 | `actions/setup-node@v4` | Node.js 20 |
| 3 | `git clone conduit-app` | Скачать само приложение Conduit |
| 4 | `npm install` (в conduit-app) | Установить зависимости приложения |
| 5 | `node index.js > /tmp/backend.log &` | Запустить Express бэкенд в фоне (`&`) |
| 6 | `wait-on http://localhost:3001/api/tags` | Ждать пока бэкенд ответит (макс 120 сек) |
| 7 | `curl POST /api/users` | Создать тест-пользователя `qa_test` |
| 8 | `curl POST /api/articles` | Создать seed-статью с тегом `qa` |
| 9 | `npm install` (в QA-репо) | Установить Newman и Playwright |
| 10 | Newman — основная коллекция | 18 запросов, 34 утверждения |
| 11 | Newman — edge-case коллекция | 8 запросов, 15 утверждений |
| 12 | Upload artifact `junit-api` | Сохранить XML для quality-gate |

**Почему `&` после старта бэкенда:**
`&` запускает процесс в фоне — без него шаг завис бы навсегда (Express не завершается сам).

**Почему `wait-on`:**
После `&` следующий шаг начинается немедленно, но бэкенд ещё не поднялся. `wait-on` делает HTTP-запросы в цикле пока не получит ответ, либо не истечёт timeout.

**Почему сначала создать юзера, потом seed-статью:**
Newman-коллекция ожидает что пользователь `qa_test` существует. Seed-статья с тегом `qa` нужна для теста фильтрации по тегу.

---

## JOB 3 — `e2e-tests`

**Назначение:** End-to-End тесты через Playwright. Открывает реальный браузер (Chromium), кликает по UI, проверяет что пользователь видит правильный результат.

**Инфраструктура:** нужен **весь стек** — PostgreSQL + бэкенд + фронтенд.

### Отличие от api-tests:
- Добавляется шаг запуска фронтенда: `npm run dev -w frontend > /tmp/frontend.log &`
- `wait-on` ждёт оба сервиса: `http://localhost:3001/api/tags` И `http://localhost:3000`
- Устанавливается Playwright с браузером: `npx playwright install --with-deps chromium`

### Ключевые шаги:
```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
  # --with-deps устанавливает системные библиотеки (GTK, libnss и т.д.)
  # нужно только для CI — локально они уже есть

- name: Run Playwright tests
  env:
    PLAYWRIGHT_JUNIT_OUTPUT_NAME: reports/junit/playwright-results.xml
  run: npx playwright test --project=chromium --reporter=html,list,junit
  # --project=chromium  — только Chromium в CI (Firefox слишком медленный)
  # --reporter=html     → reports/html/index.html  (красивый HTML отчёт)
  # --reporter=list     → вывод в консоль построчно
  # --reporter=junit    → XML файл для quality-gate
```

### Артефакты:
- `playwright-report` — HTML отчёт (скачать из Actions → Artifacts, открыть index.html)
- `junit-e2e` — XML для quality-gate

---

## JOB 4 — `quality-gate`

**Назначение:** собрать результаты всех трёх job-ов и вынести финальный вердикт.

```yaml
quality-gate:
  needs: [unit-tests, api-tests, e2e-tests]
  if: always()   # запускается даже если предыдущие job-ы упали
```

**`if: always()`** — критически важно. Без этого quality-gate не запустился бы если какой-то тест упал, и мы бы не увидели сводки.

### Как работает:

**Шаг 1 и 2** — скачать XML артефакты от api-tests и e2e-tests:
```yaml
- uses: actions/download-artifact@v4
  with:
    name: junit-api
    path: reports/junit/
  continue-on-error: true   # не упасть если артефакт не создался
```

**Шаг 3** — bash-скрипт парсит XML:
```bash
# Пример для Playwright XML:
FAILURES=$(grep -oP 'failures="\K[0-9]+' reports/junit/playwright-results.xml | head -1)
# grep -oP  — regex с lookahead, вытаскивает число после failures="
# \K        — "забудь всё что было до этого" (lookbehind)
# head -1   — берёт только первое совпадение (атрибут testsuite)
```

**Результат unit-tests** берётся из контекста job-а, не из XML:
```yaml
UNIT_RESULT="${{ needs.unit-tests.result }}"
# значение: "success" | "failure" | "cancelled" | "skipped"
```

**Финальный вердикт:**
- `exit 0` → все гейты прошли → пайплайн зелёный → merge разрешён
- `exit 1` → хотя бы один гейт упал → пайплайн красный → merge заблокирован

**Шаг 4** — `dorny/test-reporter@v1`:
Публикует JUnit XML в красивом виде во вкладке "Test Results" на странице Actions. Показывает каждый тест по имени с результатом.

---

## Quality Gates — таблица порогов

| Gate ID | Что проверяется | Порог | Как проверяется |
|---|---|---|---|
| QG01 | E2E тесты (Playwright) | 100% pass | XML `failures="0"` |
| QG02 | API тесты основные (Newman) | 100% pass | XML `failures="0"` |
| QG02b | API тесты edge-case (Newman) | 100% pass | XML `failures="0"` |
| QG03 | Критические дефекты | 0 | любой провал → exit 1 |
| QG04 | Unit тесты | все pass | job result = "success" |

---

## Артефакты — что скачать после прогона

В GitHub Actions → конкретный run → раздел **Artifacts**:

| Артефакт | Что внутри | Как использовать |
|---|---|---|
| `playwright-report` | HTML отчёт | Скачать → распаковать → открыть `index.html` |
| `junit-api` | XML Newman main + edge | Для интеграции с другими инструментами |
| `junit-e2e` | XML Playwright | То же |

**Retention: 7 дней** — через неделю артефакты удаляются автоматически.

---

## Переменные окружения бэкенда

```yaml
NODE_ENV: development
PORT: 3001
JWT_KEY: ci_test_secret_key    # секрет для подписи JWT токенов
DEV_DB_USERNAME: conduit
DEV_DB_PASSWORD: conduit
DEV_DB_NAME: conduit_ci
DEV_DB_HOSTNAME: localhost
DEV_DB_DIALECT: postgres
```

`JWT_KEY` — если изменить, все старые токены станут невалидными. В CI каждый run начинается с чистой БД, поэтому фиксированный ключ безопасен.

---

## Дебаг если что-то упало

**Бэкенд не поднялся** (wait-on timeout):
```yaml
- name: Show backend log on failure
  if: failure()
  run: cat /tmp/backend.log || echo "No backend log found"
```
Шаг запускается только при падении job-а (`if: failure()`). Выводит лог бэкенда в консоль Actions.

**Playwright тест упал:**
→ Скачать артефакт `playwright-report` → открыть `index.html` → найти упавший тест → посмотреть скриншот и видео.

**Newman тест упал:**
→ В логах шага "Run Newman" видно какой именно запрос и assertion упал.
