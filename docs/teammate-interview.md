# Интервью с тиммейтом — Исследовательские ответы
## Проект: Conduit RealWorld App — Midterm QA Report
**Дата интервью:** 2026-04-11

---

## Блок 1 — Общий контекст проекта

**В1. Какие конкретно модули тестировал?**

Покрыли все шесть модулей из risk assessment, но с разной глубиной:
- **Auth** — полностью: register, login (valid/invalid/nonexistent), logout, JWT validation, edge cases (XSS password, double-click)
- **Articles** — полностью: full CRUD через UI и API, slug mutation trap, auth guard на editor
- **Feed** — полностью: toggle, tabs (Your Feed / Global Feed), tag filter, pagination API
- **Comments** — только API (add/get/delete); UI тесты не писали — приоритет отдали HIGH-risk UI
- **Profile** — только один API запрос (GET profile); follow/unfollow не автоматизировали
- **Favorites** — только мануал

Итого автоматизировано: 36 из 37 функций = 97.3%.

**В2. Разделение ролей в команде?**

Да, явное разделение:
- Один отвечал за Playwright UI тесты (auth.spec, articles.spec, feed.spec)
- Второй — за Newman API коллекцию и CI/CD (GitHub Actions)
- Третий — за документацию (risk-assessment, test-strategy, reports)

На практике CI/CD писали вместе — там было много итераций из-за того что backend не стартовал с первого раза.

**В3. Процесс работы — сначала тест-кейсы или сразу код?**

Сначала таблица тест-кейсов в Markdown — она видна в `assignment2-report.md` (Step 2). Только после того как тест-кейс описан (ID, input, expected) — начинали кодить. Это помогло не упустить негативные сценарии: когда видишь таблицу — очевидно что не хватает negative-теста.

Единственное исключение — smoke тесты. Их написали "с нуля" сразу в коде как proof-of-concept что Playwright вообще работает с HashRouter.

---

## Блок 2 — Тест-дизайн и покрытие

**В4. Почему Favorites оставили на мануал?**

Три причины:
1. **Риск LOW** — favorites это изолированный toggle-счётчик. Ничего в системе не зависит от `favoritesCount`. Нет downstream-эффекта.
2. **Нет критического пути** — пользователь может полноценно читать и писать статьи без favorites.
3. **ROI** — время написания теста vs. вероятность что именно favorites сломается и блокирует юзера = невыгодно на этом этапе.

По методологии RBTM (Risk-Based Test Management): LOW-risk модули автоматизируются в последнюю очередь или остаются на exploratory/manual testing.

**В5. Были ли негативные сценарии помимо отчёта?**

В midterm добавили:
- **TC-AUTH-FAIL-01** — пустые поля: HTML5 `required` блокирует submit → API call не происходит
- **TC-AUTH-FAIL-02** — SQL injection в пароле: `' OR '1'='1'; DROP TABLE users;--` → bcrypt отклоняет, 422
- **TC-ART-EDGE-01** — XSS в заголовке: `<script>alert(1)</script>` → React экранирует, alert не срабатывает
- **TC-API-FAIL-01** — create article без токена → 401
- **TC-API-INV-01** — malformed JWT → должен быть 401, по факту 500 (нашли новый дефект D10)

В A2 негативы были на уровне "неправильный пароль" и "дублирующийся email". В midterm углубились.

**В6. Что намеренно пропустили из-за сложности/времени?**

- **Follow/unfollow** — требует двух авторизованных пользователей и усложняет seed data
- **Pagination UI** — клик "следующая страница" не автоматизирован (только API pagination)
- **Settings page** — форма редактирования профиля (bio, image, username): написали только guard-тест (нельзя зайти без логина)
- **File upload** — нет в Conduit, но если бы был — отдельная тема
- **Token expiry** — JWT истекает по времени. Тест с намеренно просроченным токеном не написан. Это самый серьёзный gap в Auth coverage.

---

## Блок 3 — Технические детали

**В7. Почему Playwright, а не Cypress?**

Рассматривали. Ключевое отличие:

| | Playwright | Cypress |
|---|---|---|
| Cross-browser | Chromium + Firefox + WebKit | Только Chromium (Firefox экспериментальный) |
| Multiple tabs | Поддерживает | Не поддерживает |
| Network intercept | `page.route()` — полный контроль | `cy.intercept()` — похоже, но ограничен |
| Shadow DOM | Поддерживает | Нет |
| Языки | JS, TS, Python, Java, C# | Только JS/TS |
| CI | `--with-deps` ставит всё | Нужен `cypress/included` Docker image |
| Модель | out-of-process (изолирован от браузера) | in-process (тест выполняется внутри браузера) |

Решающий фактор: Playwright быстрее стартует в CI (`--with-deps chromium` vs. Cypress Docker image ~700MB). Для академического проекта это критично.

**В8. Почему Newman, а не pytest+requests или REST Assured?**

- **REST Assured** — Java. Проект на Node.js/JS. Отдельный Java-стек = лишние зависимости в CI, lишний `mvn install`.
- **pytest+requests** — хороший выбор для Python-проектов. В нашем случае уже был Node.js, добавлять Python-окружение в CI не хотелось.
- **Newman** — запускает готовую Postman-коллекцию из CLI. Ключевое: **коллекцию можно открыть в Postman GUI и руками проверить запрос** не трогая код. Это снижает порог входа для тиммейта который не пишет тесты но хочет понять что происходит.

Плюс: variable chaining (`{{token}}` → `{{slug}}` → `{{commentId}}`) встроен в Postman — не нужно писать логику сохранения состояния вручную.

**В9. Как устроен `login()` хелпер?**

```js
async function login(page) {
  await page.goto('/#/login');
  await page.locator('input[placeholder="Email"]').fill(TEST_USER.email);
  await page.locator('input[placeholder="Password"]').fill(TEST_USER.password);
  await page.locator('button:has-text("Login")').click();
  await expect(page.locator('nav')).toContainText(TEST_USER.username);
}
```

**Идёт через UI каждый раз** — полноценный браузерный логин. Это медленнее чем прямой `POST /api/users/login` с сохранением localStorage, но:
1. Гарантирует что сам UI-логин работает (это тоже тест)
2. Playwright не имеет проблем с cross-origin localStorage injection
3. В реальных условиях CI (~0.7s на логин) это приемлемо

Альтернатива — `page.evaluate(() => localStorage.setItem('token', ...))` — быстрее, но тестирует меньше.

**В10. Seed data — как устроена?**

Создаётся через curl в pipeline перед запуском тестов:
```bash
# Шаг 1: создать юзера
curl -s -X POST http://localhost:3001/api/users -d '{"user":{...}}'

# Шаг 2: залогиниться, получить token
TOKEN=$(curl ... | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Шаг 3: создать статью с тегом "qa"
curl -s -X POST http://localhost:3001/api/articles -H "Authorization: Token $TOKEN" ...
```

**Что будет если seed упадёт:**
- Шаги создания seed в CI написаны без `|| exit 1` — они не прерывают pipeline при ошибке (curl с `-o /dev/null` всегда возвращает 0)
- TC-FD-03 (article previews visible) — упадёт если seed-статьи нет
- TC-FD-05 (tag filter) — пропустится через `test.skip()` если нет тегов в БД
- Остальные тесты: не зависят от seed статьи

Это осознанный компромисс. Seed-failure не ломает весь pipeline.

**В11. Тесты изолированы или есть зависимости?**

**API тесты (Newman):** НЕ изолированы — это одна цепочка. Register → Login → Create Article → Update → Comment → Delete. Если Create упадёт, Delete тоже упадёт (нет `{{slug}}`). Это сознательный выбор: имитируем реальный user flow.

**UI тесты (Playwright):** каждый тест изолирован по состоянию браузера (новый `page` = новая сессия). НО: `TC-AR-02` (view article) требует что в БД есть хотя бы одна статья — зависит от seed.

Полная изоляция (factory + teardown per test) была бы лучше с точки зрения надёжности, но значительно сложнее в реализации.

---

## Блок 4 — Найденные дефекты

**В12. Три самых серьёзных дефекта?**

**1. D05 — slug mutation при обновлении статьи**
Это настоящий application bug, не проблема теста. Изменение заголовка меняет slug — все сохранённые URL статьи становятся невалидными. Пользователь, который поделился ссылкой на статью и потом её отредактировал, невольно сломал ссылку для всех читателей. Это silent data-integrity bug — никакого error feedback нет, просто 404.

**2. D10 — 500 вместо 401 на malformed JWT**
Backend не обрабатывает `JsonWebTokenError` от `jsonwebtoken.verify()`. Необработанное исключение → Express global error handler → 500. По RFC 7519 должен быть 401. Проблема: если фронтенд проверяет именно 401 для редиректа на логин — он не среагирует на 500. Пользователь увидит generic server error вместо "пожалуйста войдите".

**3. D07 — window.confirm блокирует Playwright**
Это не баг приложения в традиционном смысле, но показывает архитектурный выбор: нативный `window.confirm` вместо кастомного модального диалога. Это плохо для UX (нельзя кастомизировать стиль), плохо для тестируемости (требует специального обращения в автоматизации), и потенциально блокирует будущее headless browser тестирование.

**В13. D07 — баг приложения или проблема теста?**

Проблема обоих:
- **Приложение:** использует `window.confirm()` — устаревший паттерн. Современные SPA используют кастомные modal диалоги.
- **Тест:** Playwright по умолчанию не знает что делать с нативным dialog — он его просто закрывает (dismiss). Без явного `page.on('dialog', d => d.accept())` клик на "Delete Article" не производит удаления.

Проявлялось так: тест TC-AR-03 висел, потом `expect(page).toHaveURL(/#\//)` падал с timeout — пользователь всё ещё на странице статьи. Без `page.on('dialog')` удаление просто не происходило.

**В14. Был ли хоть один баг в самом приложении Conduit (не в тестах)?**

Да, два реальных application-level дефекта:

1. **D05 — slug mutation** (подробно выше) — это реальный UX дефект в бизнес-логике
2. **D10 — 500 на malformed JWT** — некорректная обработка ошибок в middleware

Остальные 8 дефектов (D01–D04, D06–D09) были на стороне тестов: неверные CSS-селекторы, неправильные предположения о HTML-структуре, несоответствие ожидаемого HTTP-кода.

**Важный вывод:** автоматизация вскрыла реальные баги которые мануальное тестирование, скорее всего, пропустило бы. D10 требует намеренно испорченного JWT — кто будет вручную тестировать это?

**В15. Были ли flaky tests?**

За всё время — ноль. Но была одна почти-flaky ситуация: TC-FD-05 (tag filter) на ранних CI прогонах иногда проходил, иногда пропускался через `test.skip()`. Причина: seed-статья с тегом "qa" иногда успевала проиндексироваться, иногда нет.

Решение: убрать `waitFor` с timeout и заменить на `count()` check + `test.skip()` если тегов нет. После этого поведение стало детерминированным — либо тест проходит (есть теги), либо пропускается (нет тегов). Не падает никогда.

Стабильность достигнута через:
- `toBeVisible({ timeout: 10000 })` вместо дефолтных 5000ms
- `retries: 1` в playwright.config.js (перегон на первом фейле)
- детерминированный seed (curl создаёт статью до запуска тестов)

---

## Блок 5 — CI/CD и метрики

**В16. Сколько занимает полный прогон пайплайна?**

Из GitHub Actions logs:

| Этап | Время |
|---|---|
| PostgreSQL health check | ~15s |
| Clone app + npm install | ~45s |
| Start backend + wait-on | ~20s |
| Start frontend + wait-on | +15s |
| Seed data (curl) | ~3s |
| Install QA deps | ~20s |
| Playwright install chromium | ~30s |
| Run Playwright (23 tests) | ~25s |
| Run Newman (18 + 8 requests) | ~5s |
| Artifacts upload | ~10s |
| **TOTAL** | **~3–5 min** |

С новой структурой (4 job-а параллельно) реальное wall-clock время ~3 минуты: unit-tests (~15s) и api-tests (~2 min) идут параллельно с e2e-tests (~3 min), quality-gate ждёт самого долгого.

**В17. Сколько раз пайплайн падал до стабилизации?**

Примерно 8–10 прогонов до первого полностью зелёного. Хронология падений:

| Прогон | Причина |
|---|---|
| 1–2 | `baseURL: 5173` (Vite default) вместо 3000 |
| 3 | Playwright не находил `input[type="email"]` — нет такого атрибута |
| 4 | HashRouter: `/login` не работает, нужен `/#/login` |
| 5 | Newman: `DELETE /api/articles` 404 после `PUT` (slug mutation, D05) |
| 6 | Newman: Comments 404 — коллекция запускалась после Delete article |
| 7 | CI: `DEV_DB_LOGGING: "false"` (строка вместо bool) → TypeError в Sequelize |
| 8 | CI: `sequelize.sync()` падал — manual migrations не нужны |
| 9–10 | dorny/test-reporter: нужен `permissions: checks: write` |

Каждый был детерминированным багом — не случайностью. После каждого фикса следующий прогон либо проходил, либо вскрывал следующую проблему.

**В18. Есть ли скриншоты/артефакты из Actions?**

Да:
- GitHub Actions history: https://github.com/n1tr0oo/qa-conduit/actions
- Артефакты в каждом run: `playwright-report` (HTML), `junit-results` (XML)
- HTML-отчёт: скачать zip → распаковать → открыть `index.html` → видно каждый тест с таймлайном и скриншотом при фейле
- С midterm добавился `allure-dashboard` — объединённый дашборд по всем суитам

**В19. Firefox тесты — CI или только локально?**

Только локально. В CI — только Chromium. Причины:
- Firefox добавляет ~44 секунды к общему времени (2.5× медленнее Chromium)
- `npx playwright install --with-deps firefox` в CI — ещё +30s и ~200MB
- В академическом контексте cross-browser coverage ≠ приоритет
- Все 23 теста прошли на Firefox локально без изменений — значит кода не оптимизированы под один браузер

Для продакшн-проекта добавили бы Firefox как отдельный Playwright project с `fail-on-error: false` для информирования, не блокирования.

---

## Блок 6 — Анализ и обоснование

**В20. Если бы было ещё 2 недели — что добавили бы первым?**

По приоритету:

1. **Token expiry test** — создать JWT с `expiresIn: '1s'`, подождать 2 секунды, отправить запрос → должен быть 401. Сейчас это единственный полностью непокрытый happy-path в Auth.

2. **Follow/unfollow** — требует второго юзера. Завели бы `qa_test_2@example.com` в seed. Критично для социального графа — если follow сломан, Your Feed всегда пустой (тихий баг).

3. **Pagination UI** — кликнуть "страница 2", проверить что статьи изменились и URL содержит `?page=2` или соответствующий offset. Сейчас pagination покрыт только на уровне API.

4. **D10 fix** — написать `try/catch` в authentication middleware вокруг `jwt.verify()` и бросать `401` вместо пробрасывания в Express error handler.

5. **Istanbul/c8 coverage** — инструментировать бэкенд для сбора реального code coverage, убрать оценки "~80%" на конкретные числа.

**В21. Главный технический вывод?**

**Автоматизация вскрывает предположения о системе.**

До написания тестов был уверен что `<nav>` содержит `<a>` теги для навигации — это "стандарт". Оказалось feed tabs это `<button>` (D08). Был уверен что DELETE возвращает 204 — стандарт REST. Оказалось 200 (D09). Был уверен что неверный JWT даёт 401 — RFC 7519. Оказалось 500 (D10).

Каждый дефект это место где реальность расходилась с предположением. **Тесты не ищут баги — они проверяют предположения. Баги находятся когда предположение оказывается неверным.**

Второй вывод: seed data в CI — скрытая зависимость. TC-FD-05 проходит только если curl в шаге "Create seed article" успешно выполнился. Если он упал тихо (exit 0 с ошибкой в теле) — тест просто пропускается. Это false-positive риск который мы не устранили полностью.

**В22. Что в отчёте расходится с реальностью?**

Несколько моментов:

**1. "100% coverage" HIGH-risk модулей** — формально верно (все функции из списка покрыты). Но coverage считался по списку функций который мы сами и составили. Token expiry, follow/unfollow, Settings page edit — не вошли в список HIGH-risk функций изначально. Если бы вошли — coverage был бы не 100%.

**2. "0 flaky tests"** — верно для финального состояния. Но TC-FD-05 в процессе разработки несколько раз падал непредсказуемо пока не переписали логику. В отчёте это задокументировано как "resolved", но пара прогонов были реально flaky.

**3. "CI pipeline ~5 minutes"** — это медиана. Реально бывало 7–8 минут когда GitHub runner был под нагрузкой (shared infrastructure). В отчёте указано "~5 min" как типичное значение.

**4. Сложность newman variable chaining** — в отчёте это выглядит как элегантное решение. На практике отладка цепочки `token → slug → commentId` с `pm.collectionVariables.set()` заняла несколько часов: Newman не даёт inline debugger, ошибки в test-script молча глотались.

---

## Ключевые цитаты для статьи

> "Automated tests do not find bugs — they verify assumptions. Bugs are found when an assumption is wrong." — практический вывод проекта

> "Nine defects found; two were application bugs, seven were wrong test assumptions. This ratio is expected in exploratory automation: you learn the system by writing tests for it."

> "The slug mutation defect (D05) exemplifies a class of silent failures: no error is thrown, no 404 is logged at creation time — the failure only manifests when a previously-valid URL is requested later. Only sequential test execution (create → update → get old slug) can surface this class of bug."

> "The 500-instead-of-401 defect (D10) illustrates middleware error handling debt: a JsonWebTokenError propagating uncaught through the Express stack produces a generic 500 response. Frontend code checking for 401 to trigger a redirect to login will silently fail, leaving the user on a broken page."
