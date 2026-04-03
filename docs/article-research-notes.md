# Research Notes for Academic Article
## Project: Conduit RealWorld App — Assignment 2

---

## 1. Выбор инструментов (Methodology)

### UI: Playwright vs Selenium

| Критерий | Playwright | Selenium |
|----------|-----------|---------|
| Ожидание элементов | Auto-wait встроен — нет нужды в `sleep`/`waitForElement` | Ручные `WebDriverWait`, нестабильны |
| Скорость | CDP-протокол напрямую с браузером | WebDriver — дополнительный HTTP-слой, медленнее |
| Установка | `npx playwright install` — всё в одну команду | Отдельные драйверы (chromedriver, geckodriver), версии конфликтуют |
| Браузеры | Chromium, Firefox, WebKit из коробки | Chromium, Firefox (WebKit только через Safaridriver) |
| CI/CD | Первоклассная поддержка, `--with-deps` ставит системные зависимости | Нужен X-сервер или Xvfb на Linux |
| Язык | JS/TS, Python, Java, C# | Те же, но JS-биндинг хуже развит |
| Активность | Microsoft, быстрый цикл обновлений | SeleniumHQ, более консервативный |

**Вывод:** Playwright быстрее на 20–40% и стабильнее на SPA (React, Vue).

**Для статьи:** *"Comparative analysis of Playwright vs Selenium 2023"*

---

### API: Newman/Postman vs REST Assured

| Критерий | Newman (Postman) | REST Assured |
|----------|-----------------|-------------|
| Язык | Коллекция в JSON, тесты на JS | Java — нужен Maven/Gradle проект |
| Порог входа | Создаёшь запросы визуально в Postman GUI | Только код |
| Командная работа | Коллекция в JSON — в Git, можно делать PR | Тесты как Java-файлы |
| Переменные | Цепочки переменных встроены (`{{token}}`, `{{slug}}`) | Программные переменные в Java |
| CI/CD | `npx newman run collection.json` — одна строка | Нужен `mvn test` или Gradle |
| Отчёт | Детальный вывод per-request из коробки | JUnit XML, нужен настраивать |

**Вывод:** REST Assured выигрывает в сложных сценариях на Java-стеке. Для JavaScript-проекта Newman — очевидный выбор.

---

## 2. Оценка рисков (Introduction + Risk Assessment)

### HIGH-risk модули и бизнес-влияние

#### 1. User Authentication — HIGH
JWT — единственная граница безопасности приложения. Если Auth сломан:
- Все `POST/PUT/DELETE` эндпоинты возвращают 401
- Никто не может создать статью, оставить комментарий, подписаться
- **100% функциональности для авторизованных пользователей заблокировано**
- Это «single point of failure» всей системы

#### 2. Article Management — HIGH
Slug генерируется из title. Если slug меняется при `PUT` и не захватывается повторно:
- `GET /articles/:old-slug` → 404
- `DELETE /articles/:old-slug` → 404
- Вся CRUD-цепочка рушится
- **Основной бизнес-процесс платформы (публикация контента) сломан**

#### 3. Global Feed & Pagination — HIGH
Главная страница — первый экран для 100% пользователей (авторизованных и нет). Limit/offset — единственный механизм навигации по контенту. Если сломан:
- Приложение визуально пустое
- Невозможно найти ни одну статью
- **Полная потеря usability — платформа неиспользуема как ридер**

**Для статьи:** *"Risk-based testing strategy in Agile DevOps"* — методология RBTM (Risk-Based Test Management), Felderer & Ramler.

---

## 3. Пороги качества (Quality Gates)

| Gate | Threshold | Обоснование |
|------|-----------|-------------|
| UI test pass rate | **100%** | Любой провал = регрессия в user-facing функциональности |
| API assertion pass rate | **100%** | API — контракт между FE и BE; частичный провал неприемлем |
| Critical bugs при деплое | **0** | Стандарт Zero-Defect Policy для продакшн-деплоя |
| HIGH-risk module coverage | **100%** | Полное покрытие критических путей — аксиома risk-based testing |
| MEDIUM-risk coverage | **≥ 80%** | ISO/IEC 25010 рекомендует 80% для вторичных функций |
| Pipeline | **Green** | Broken build = блокировка команды (принцип fail-fast CI) |

**Цифра 80% не с потолка** — из промышленных стандартов:
- **ISO/IEC 25010** (Software Quality Model) — структурное качество
- **Google Testing Blog** — 70–80% unit coverage как минимум
- **Martin Fowler** — "Test Coverage" — 80% как практическая цель

**Для статьи:** *"Quality Gates in Continuous Integration"*, *"ISO IEC 25010 software quality"*

---

## 4. Сложность системы (System Description)

### База данных — 7 таблиц

| # | Таблица | Тип | Поля |
|---|---------|-----|------|
| 1 | Users | Основная | id, email, username, bio, image, password |
| 2 | Articles | Основная | id, slug, title, description, body, userId |
| 3 | Comments | Основная | id, body, userId, articleId |
| 4 | Tags | Основная | id, name |
| 5 | TagList | Junction (Article↔Tag) | articleId, tagId |
| 6 | Favorites | Junction (User↔Article) | userId, articleId |
| 7 | Followers | Junction (User↔User) | userId, followerId |

### API эндпоинты — 19 штук

| Группа | Метод + Путь |
|--------|-------------|
| Users | POST /api/users |
| Users | POST /api/users/login |
| User | GET /api/user |
| User | PUT /api/user |
| Articles | GET /api/articles |
| Articles | POST /api/articles |
| Articles | GET /api/articles/feed |
| Articles | GET /api/articles/:slug |
| Articles | PUT /api/articles/:slug |
| Articles | DELETE /api/articles/:slug |
| Comments | GET /api/articles/:slug/comments |
| Comments | POST /api/articles/:slug/comments |
| Comments | DELETE /api/articles/:slug/comments/:id |
| Favorites | POST /api/articles/:slug/favorite |
| Favorites | DELETE /api/articles/:slug/favorite |
| Profiles | GET /api/profiles/:username |
| Profiles | POST /api/profiles/:username/follow |
| Profiles | DELETE /api/profiles/:username/follow |
| Tags | GET /api/tags |

### Страницы (интерактивные views) — 9

| # | Страница | URL |
|---|----------|-----|
| 1 | Home / Global Feed | `/#/` |
| 2 | Login | `/#/login` |
| 3 | Register | `/#/register` |
| 4 | Article View (с комментариями) | `/#/article/:slug` |
| 5 | Article Editor — создание | `/#/editor` |
| 6 | Article Editor — редактирование | `/#/editor/:slug` |
| 7 | User Profile — My Articles | `/#/profile/:username` |
| 8 | User Profile — Favorited Articles | `/#/profile/:username/favorites` |
| 9 | Settings | `/#/settings` |

**Для статьи:** ссылайся на [gothinkster/realworld](https://github.com/gothinkster/realworld) как на стандартизированный эталонный проект (признанный бенчмарк в сообществе, используется в академических работах по сравнению веб-технологий).
