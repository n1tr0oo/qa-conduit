# Шпаргалка для защиты
## Проект: Conduit RealWorld App — QA Automation

---

## Стек проекта (отвечать быстро)

| Слой | Технология |
|---|---|
| Frontend | React 19, React Router (HashRouter), Vite |
| Backend | Express.js 5, Sequelize ORM |
| Database | PostgreSQL 15 |
| Auth | JWT (jsonwebtoken) |
| QA — E2E | Playwright 1.59.1 |
| QA — API | Newman 6.2.2 (Postman CLI) |
| QA — Unit | Node.js `node:test` (встроенный) |
| CI/CD | GitHub Actions |

**URL локально:**
- Frontend: `http://localhost:3000` (HashRouter → `/#/login`, `/#/register` и т.д.)
- Backend API: `http://localhost:3001/api`

---

## Структура тестов — что где лежит

```
tests/
├── unit/
│   └── slugify.test.mjs        13 unit-тестов  (node --test)
├── ui/
│   ├── smoke.spec.js            4 smoke-теста   (Playwright)
│   ├── auth.spec.js             6 auth-тестов   (Playwright)
│   ├── articles.spec.js         5 article-тестов(Playwright)
│   ├── feed.spec.js             8 feed-тестов   (Playwright)
│   └── edge-cases.spec.js       5 edge-тестов   (Playwright)
└── api/
    ├── conduit.postman_collection.json        18 запросов / 34 утверждения
    └── conduit-edge-cases.postman_collection.json  8 запросов / 15 утверждений
```

**ИТОГО: 65 тестов**
- 13 unit
- 28 E2E (Playwright)
- 26 API запросов / 49 утверждений (Newman)

---

## Все тест-кейсы с объяснением

### UNIT TESTS — `tests/unit/slugify.test.mjs`

Тестируем функцию `slugify(string)` из бэкенда. Она конвертирует заголовок статьи в slug (URL-безопасная строка).

**Логика функции:**
```js
function slugify(string) {
  return string.trim().toLowerCase().replace(/\W|_/g, '-');
}
// "Hello World" → "hello-world"
// \W = любой не-word символ (не буква, не цифра, не _)
// _ тоже заменяется отдельно
```

| ID | Что тестируем | Пример |
|---|---|---|
| TC-UNIT-01 | Стандартные строки | "Hello World" → "hello-world" |
| TC-UNIT-02 | Пустая строка / только пробелы | "" → "", "   " → "" |
| TC-UNIT-03 | Числа в строке | "article 42" → "article-42" |
| TC-UNIT-04 | Спецсимволы (XSS, SQL-injection, emoji) | `<script>` → нет `<` `>` в результате |
| TC-UNIT-05 | Последовательные разделители | "hello\tworld" → "hello-world" |

**Почему важно тестировать slugify:**
Slug используется как URL (`/api/articles/hello-world`). Если slug поменяется при обновлении статьи — старые URL дадут 404. Это реальный баг (нашли в A2, D05).

---

### SMOKE TESTS — `tests/ui/smoke.spec.js`

Базовая проверка что приложение запустилось и основные страницы открываются.

| ID | Тест | Проверяет |
|---|---|---|
| TC-SM-01 | Homepage loads | Заголовок страницы содержит `/conduit/i` |
| TC-SM-02 | Navigation bar visible | `<nav>` виден |
| TC-SM-03 | Login page loads | Поля Email и Password видны на `/#/login` |
| TC-SM-04 | Register page loads | Поля Name, Email, Password видны на `/#/register` |

**Запускается первым** — если smoke упал, дальше гнать тесты бессмысленно.

---

### AUTH TESTS — `tests/ui/auth.spec.js`

| ID | Тест | Сценарий | Ожидание |
|---|---|---|---|
| TC-AU-01 | Login valid | Правильный email + пароль | Редирект на `/#/`, navbar содержит "qa_test" |
| TC-AU-02 | Login wrong password | Правильный email, неверный пароль | `ul.error-messages` появляется (10s timeout) |
| TC-AU-03 | Login non-existent user | Email которого нет в БД | `ul.error-messages` |
| TC-AU-04 | Register new user | Уникальный email (timestamp) | Редирект на `/#/`, navbar содержит username |
| TC-AU-05 | Register duplicate email | Email уже зарегистрирован | `ul.error-messages` |
| TC-AU-06 | Logout | Клик по dropdown → Logout | URL `/#/`, navbar содержит "Login" |

**Нюансы при реализации:**
- Logout требует сначала открыть dropdown: `.nav-link.dropdown-toggle` → `.dropdown-item:has-text("Logout")`
- Сообщения об ошибке: timeout 10 000ms (API возвращает 422 с задержкой)

---

### ARTICLE TESTS — `tests/ui/articles.spec.js`

| ID | Тест | Сценарий |
|---|---|---|
| TC-AR-01 | Create article | Заполнить форму редактора → submit → URL `/#/article/...`, h1 совпадает |
| TC-AR-02 | View article | Кликнуть первый `a.preview-link` → открывается страница статьи |
| TC-AR-03 | Delete article | Создать → кликнуть Delete → принять confirm → редирект на `/#/` |
| TC-AR-04 | Edit article | Создать → Edit → изменить заголовок → h1 обновился |
| TC-AR-05 | Auth guard on editor | Зайти на `/#/editor` без логина → НЕ должны остаться на editor |

**Нюансы:**
- `page.on('dialog', d => d.accept())` — нужен для `window.confirm` при удалении
- `h1` — несколько на странице, нужен `.article-page h1`
- Кнопка Delete рендерится дважды → используем `.first()`
- **D05**: изменение заголовка меняет slug → URL статьи меняется

---

### FEED TESTS — `tests/ui/feed.spec.js`

| ID | Тест | Проверяет |
|---|---|---|
| TC-FD-01 | Feed toggle visible | `.feed-toggle` виден |
| TC-FD-02 | Global Feed tab active | `button.active` содержит "Global Feed" |
| TC-FD-03 | Article previews shown | `.article-preview` виден (нужен seed) |
| TC-FD-04 | Sidebar visible | `.sidebar` виден |
| TC-FD-05 | Tag filter | Клик на `button.tag-pill` → активный таб меняется |
| TC-FD-06 | Your Feed visible | После логина в feed-toggle появляется "Your Feed" |
| TC-FD-07 | Your Feed clickable | Клик на Your Feed → таб активен |
| TC-FD-08 | Article preview navigates | Клик на `a.preview-link` → URL `/#/article/...` |

**Нюансы:**
- Табы — это `<button>`, не `<a>` (D08)
- Tag pills — тоже `<button class="tag-pill">`, не `<a>` (D08)
- TC-FD-05 пропускается (`test.skip`) если нет тегов в БД — нужен seed

---

### EDGE-CASE TESTS — `tests/ui/edge-cases.spec.js`

| ID | Тест | Категория | Что проверяет |
|---|---|---|---|
| TC-AUTH-FAIL-01 | Пустые поля | Failure | HTML5 `required` блокирует submit → URL остаётся `/#/login` |
| TC-AUTH-FAIL-02 | SQL injection в пароле | Failure / Invalid input | bcrypt отклоняет `' OR '1'='1'` → `ul.error-messages` |
| TC-ART-EDGE-01 | XSS в заголовке | Edge case | React экранирует `<script>` → alert НЕ срабатывает |
| TC-CONC-01 | Двойной клик на Login | Concurrency | Приложение не падает, юзер попадает на главную один раз |
| TC-INV-01 | `/#/settings` без логина | Invalid user behavior | Редирект, защищённый роут недоступен |

**Что рассказать про TC-AUTH-FAIL-01:**
Изначально тест ожидал `ul.error-messages`. Но HTML5 `<input required>` блокирует отправку формы на уровне браузера — API-запрос не отправляется вообще, поэтому ошибка от сервера не приходит. Это важное наблюдение — frontend-валидация работает, и это хорошо.

**Что рассказать про TC-ART-EDGE-01:**
React по умолчанию экранирует все строки в JSX — `<script>alert(1)</script>` в заголовке превращается в безопасный текст. Это security positive. Тест это подтверждает автоматически.

---

### API TESTS — `tests/api/conduit.postman_collection.json`

18 запросов, 34 assertion. Variable chaining: `token` → `articleSlug` → `commentId`.

| Группа | Запросы | Что проверяет |
|---|---|---|
| Authentication (HIGH) | 5 | Register, Login valid/invalid, GET /api/user с/без токена |
| Articles CRUD (HIGH) | 6 | Create, Get, Update (slug!), Delete |
| Feed & Tags (HIGH) | 3 | Список, pagination, фильтр по тегу |
| Comments (MEDIUM) | 3 | Add, Get, Delete comment |
| Profiles (MEDIUM) | 1 | GET /api/profiles/:username |

**Variable chaining объяснить так:**
После Register → сохраняем `token`. После Create Article → сохраняем `slug`. После Add Comment → сохраняем `commentId`. Каждый следующий запрос использует переменные предыдущего — это реальный пользовательский сценарий.

---

### API EDGE-CASE TESTS — `tests/api/conduit-edge-cases.postman_collection.json`

| ID | Запрос | Категория | Ожидание |
|---|---|---|---|
| TC-API-FAIL-01 | POST /api/articles без токена | Failure | 401 |
| TC-API-FAIL-02 | GET /api/articles/несуществующий-slug | Failure | 404 или 422 |
| TC-API-EDGE-01 | POST /api/users без username | Edge | 422 |
| TC-API-EDGE-02 | POST /api/users с username="" | Edge | 422 |
| TC-API-CONC-01 (x2) | POST /api/users/login × 2 | Concurrency | Оба 200, независимые JWT |
| TC-API-INV-01 | GET /api/user с фиктивным токеном | Invalid behavior | 401 или 500 (дефект D10) |

---

## Дефекты найденные за весь проект

| # | Дефект | Модуль | Риск | Статус |
|---|---|---|---|---|
| D01 | Logout: нужно открыть dropdown перед кликом | Auth | HIGH | Исправлен |
| D02 | error-messages: нужен timeout 10s | Auth | HIGH | Исправлен |
| D03 | Login button: нужен `:has-text` в селекторе | Auth | HIGH | Исправлен |
| D04 | h1 есть в нескольких местах → нужен `.article-page h1` | Articles | HIGH | Исправлен |
| D05 | Delete/Edit кнопка рендерится дважды → `.first()` | Articles | HIGH | Исправлен |
| D06 | Edit link рендерится дважды → `.first()` | Articles | HIGH | Исправлен |
| D07 | `window.confirm` блокирует Playwright → `page.on('dialog')` | Articles | HIGH | Исправлен |
| D08 | Feed tabs и tag pills — `<button>`, не `<a>` | Feed | HIGH | Исправлен |
| D09 | DELETE возвращает 200, не 204 | Articles API | HIGH | Исправлен (oneOf) |
| D10 | Malformed JWT → 500 вместо 401 (необработанный exception) | Auth | HIGH | **Открыт** |

**D10 объяснить так:** middleware в Express не обрабатывает `JsonWebTokenError` от `jsonwebtoken.verify()`. Когда приходит сломанный токен — бросается необработанное исключение, Express отдаёт 500. По RFC должен быть 401. Тест принимает оба значения и документирует это как дефект.

---

## Quality Gates — порог прохождения

| Gate | Порог | Как блокирует |
|---|---|---|
| QG01 — E2E pass rate | 100% | XML `failures > 0` → `exit 1` |
| QG02 — API main pass rate | 100% | XML `failures > 0` → `exit 1` |
| QG02b — API edge pass rate | 100% | XML `failures > 0` → `exit 1` |
| QG03 — Critical defects | 0 | Любое падение = дефект |
| QG04 — Unit tests | Все pass | job result ≠ "success" → exit 1 |

**Почему 100%, а не 90%?**
Любой упавший тест — это регрессия в пользовательской функциональности. Мы не можем знать заранее какой тест "не важен". Partial failures маскируют реальные дефекты.

---

## CI/CD Pipeline — структура в двух словах

```
push → GitHub Actions запускает 3 job-а параллельно:
  1. unit-tests   — node --test (нет БД, нет сети, ~10 сек)
  2. api-tests    — Newman (PostgreSQL + Express, ~2 мин)
  3. e2e-tests    — Playwright (PostgreSQL + Express + Vite + Chromium, ~3 мин)

→ quality-gate собирает XML от api-tests и e2e-tests,
  проверяет пороги, выдаёт итоговый pass/fail
  + публикует "Test Results" вкладку в GitHub
```

**Параллельность:** три тестовых job-а запускаются одновременно на трёх разных виртуальных машинах Ubuntu. Каждый самодостаточен — у каждого своя БД, свой бэкенд.

---

## Команды для локального запуска

```bash
# 1. Запустить приложение (два терминала)
cd conduit-realworld-example-app/backend && node index.js
cd conduit-realworld-example-app && npm run dev -w frontend

# 2. Из qa-conduit/
node --test tests/unit/*.test.mjs                           # unit
npx playwright test --project=chromium --reporter=list      # E2E
npx newman run tests/api/conduit.postman_collection.json    # API main
npx newman run tests/api/conduit-edge-cases.postman_collection.json  # API edge
```

---

## Частые вопросы на защите

**Q: Почему Playwright, а не Selenium?**
A: Playwright нативно поддерживает современные браузеры и async/await, имеет встроенный auto-wait (не нужны явные `sleep`), работает с Shadow DOM, и легко интегрируется в CI.

**Q: Почему Newman, а не чистый axios/fetch в коде?**
A: Newman запускает Postman-коллекции из CLI. Коллекция описывает реальный API-контракт — её можно открыть в Postman GUI и руками потыкать. Newman = тот же контракт, только автоматизированный.

**Q: Что такое variable chaining в Newman?**
A: После каждого запроса в test-script мы сохраняем данные: `pm.collectionVariables.set('token', json.user.token)`. Следующий запрос использует `{{token}}` в header. Это имитирует реальный пользовательский сценарий без хардкода данных.

**Q: Зачем unit тесты если есть API и E2E?**
A: Unit тест проверяет одну функцию в изоляции — быстро, без зависимостей. Если `slugify` сломается, unit тест упадёт за <1 сек. E2E тест упадёт за ~30 сек и ещё не покажет где именно проблема.

**Q: Что такое HashRouter и почему `/#/login`?**
A: HashRouter (React Router) хранит текущий маршрут в `#`-фрагменте URL. Сервер видит только `http://localhost:3000/` (без фрагмента), браузер обрабатывает `/login` сам на клиенте. Это позволяет хостить SPA на статическом сервере без настройки серверного роутинга.

**Q: Почему seed-данные нужны для тестов?**
A: TC-FD-03 (article previews) и TC-FD-05 (tag filter) требуют что в БД уже есть статья с тегом "qa". В CI БД пустая при каждом запуске. Поэтому перед тестами через curl создаётся seed-статья.

**Q: Что такое Quality Gate?**
A: Это автоматическая проверка пороговых значений. Если хотя бы одно условие не выполнено (например, pass rate < 100%) — pipeline возвращает exit code 1, что блокирует merge в GitHub.

**Q: Нашли ли вы реальные дефекты?**
A: Да, 10 дефектов. 9 исправлены. Один открытый (D10) — бэкенд возвращает 500 вместо 401 на поддельный JWT токен. Это необработанный exception в authentication middleware.
