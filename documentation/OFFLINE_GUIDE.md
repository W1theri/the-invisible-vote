# THE INVISIBLE VOTE

**A Social and Philosophical Experiment About Digital Freedom of Choice**

> What if your choice was never truly yours?

Автономный интерактивный прототип университетского проекта. Весь интерфейс, CSS, JavaScript, диаграммы и переводы находятся в `index.html`. Установка, сервер, интернет, библиотеки, CDN и внешние шрифты не нужны. Английский выбран при первом открытии; затем браузер запоминает выбранный язык.

## Быстрый запуск

1. Распакуйте файлы в постоянную папку.
2. Откройте `index.html` двойным щелчком в Chrome или Edge.
3. Для участия прочитайте уведомление, отметьте согласие и нажмите **Start Experiment**.
4. Для управления нажмите **Researcher access** внизу страницы.

Не перемещайте HTML во время сбора данных. Используйте один и тот же файл, браузер и профиль. Сразу проверьте сохранение: заполните пробный ответ, обновите страницу, проверьте его в панели и удалите перед настоящим исследованием. При предупреждении о хранилище экспортируйте JSON и не закрывайте вкладку.

## Путь участника

**Welcome → Voting → Short Survey → Experiment Reveal.**

- Участие добровольное и анонимное. До начала говорится, что часть методики объясняется после голосования.
- Система назначает A или B. Название группы не показано на экране голосования.
- Вопрос в обеих версиях: **What should our university improve first?**
- Варианты: **University Library** и **Student Lounge**. Текст, порядок и содержание предложений одинаковы внутри выбранного языка.
- Голос сохраняется немедленно, получает статус `pending` и блокируется. Обновление страницы возвращает к анкете.
- Обязательны осознанность влияния (Yes / No / Not sure) и уверенность от 1 до 5. Причина необязательна, до 500 символов. В неё нельзя вводить имена и другие личные сведения.
- После отправки запись получает статус `complete` и включается в статистику. Двойная отправка в рамках сессии не создаёт второй голос.
- В объяснении раскрываются обе версии и непроверенный характер **Popular choice**. Приложение не утверждает, что конкретный выбор был результатом манипуляции.
- **Delete my response** с подтверждением удаляет собственный голос и анкету из этого браузера. Во время голосования и анкеты доступно **Withdraw & see explanation**.

Удаление не распространяется на уже скачанные резервные копии. После запуска следующей анонимной сессии доступ к отзыву предыдущего ответа с этого экрана заканчивается. Объясните это участнику до передачи устройства.

## Проведение на одном устройстве

1. Исследователь открывает **Researcher access → Session controls**.
2. Нажимает **Start a new anonymous session**, подтверждает завершение предыдущей сессии и передаёт устройство участнику.
3. Участник проходит эксперимент, читает объяснение и решает, оставлять ли ответ.
4. Исследователь повторяет шаги для следующего человека.
5. После каждой небольшой серии участников экспортирует JSON.

Если предыдущая анкета не отправлена, новая сессия удаляет её незавершённый голос; завершённые записи сохраняются. Один человек не должен участвовать повторно: анонимная офлайн-сессия не позволяет надёжно проверить уникальность людей.

**Распределение:** когда количество назначений A и B одинаково, группа выбирается случайно; иначе назначается меньшая группа. Это случайное начало каждой сбалансированной пары. Счётчики назначений сохраняются даже при отказе участника, поэтому число завершённых анкет может отличаться. Укажите фактические `n` обеих групп в отчёте. При возможности используется `crypto.getRandomValues`.

Используйте одну вкладку и одного ведущего. Межвкладочные события обновляют отображение, но `localStorage` не предоставляет транзакций и не подходит для параллельного сбора на одном профиле.

## Как проверить Group A и Group B

Откройте **Researcher access → Session controls → Test Group A / Test Group B**.

- **A:** одинаковые белые карточки, размеры и нейтральные кнопки; без рекомендации.
- **B:** библиотека выделена цветом, рамкой, контрастной кнопкой и подсказкой **Popular choice**; зона отдыха нейтральна.
- Сверху видна маркировка тестового сеанса. Настройки группы находятся только в исследовательском режиме.
- Тестовые голоса и анкеты существуют в памяти и **не записываются ни в реальные, ни в демонстрационные данные**.
- Чтобы вернуться к реальному сбору, откройте панель, затем **Session controls → Start a new anonymous session**. Обновление страницы также завершает несохранённый тест.

Не показывайте участникам тестовые версии, панель с группами, проектор или методику до окончания их выбора: предварительное знакомство может исказить исследование.

## Панель исследователя

**Researcher access → Overview.** Панель показывает только завершённые анкеты выбранного набора:

| Блок | Содержание |
| --- | --- |
| Overview cards | Все участники, A, B, голоса за библиотеку и зону отдыха |
| A/B comparison | Доля библиотеки по группам, `n` и разница B − A в процентных пунктах |
| Awareness | Доли и количества Yes / No / Not sure для каждой группы |
| Confidence | Средняя уверенность по группам, шкала 1–5 |
| Voting distribution | Состав голосов: Library / Lounge, доли и количества в каждой группе |
| Participant responses | Случайный ID, группа, выбор, осознанность, уверенность, причина |

**Refresh Results** перечитывает локальные данные. Незавершённые голоса отмечены отдельно и исключены из всех показателей и обычных экспортов. При отсутствии данных выводится тире, а не выдуманный процент или среднее.

### Демоданные

Нажмите **Generate 40 Demo Participants**. Создаются ровно 20 синтетических участников A и 20 B; обе группы имеют одинаковую вероятность выбора библиотеки (50%). Конкретные итоги случайны: преимущество B не заложено. Осознанность и уверенность тоже варьируются. Это иллюстрация работы интерфейса, а не модель поведения людей.

Переключатель **Demo Data / Real Data** меняет набор для всех карточек, диаграмм, таблицы, экспорта и режима проектора. Демоданные явно подписаны как синтетические. Они хранятся под отдельным ключом. **Reset Demo Data** удаляет только их, с подтверждением. Повторная генерация заменяет демонабор после подтверждения. **Clear Data** очищает только выбранный набор.

### CSV и резервные копии

- **Export CSV** выгружает завершённые строки текущего набора: `dataset`, `synthetic`, `anonymous_id`, `group`, `selected_option`, `influence_awareness`, `confidence`, `reason`.
- Кодировка UTF-8 с BOM поддерживает кириллицу в Excel. Ячейки заключены в кавычки; кавычки внутри текста удваиваются. Потенциальные формулы в начале ячейки, в том числе после пробелов, обезвреживаются апострофом.
- Если Excel открывает всё в одном столбце, используйте **Данные → Из текста/CSV**, выберите UTF-8 и разделитель «запятая». Не удаляйте защитный апостроф перед открытием недоверенного текста как формулы.
- **Export JSON Backup** сохраняет один явно помеченный набор версии 1 с завершёнными ответами и счётчиками назначений. Это резервная копия для переноса результатов, а не всей текущей сессии участника.
- **Import JSON Backup** проверяет формат приложения, версию, источник, флаги синтетичности, уникальные ID, группы, ответы, уверенность, длину текста и счётчики назначений. Лимиты: 10 МБ и 10 000 записей. Неизвестные поля не сохраняются.
- После подтверждения импорт **заменяет** соответствующий набор. Он не суммирует и не объединяет файлы. Второй набор остаётся без изменений. Импорт реальных данных завершает текущую сессию участника.
- Не импортируйте несколько устройств друг за другом в надежде сложить голоса: для объединения нужен отдельный процесс очистки и проверки ID либо сервер второго этапа.

Если браузер блокирует или переполняет `localStorage`, приложение показывает предупреждение и сохраняет новые изменения в памяти до закрытия вкладки. Экспортируйте JSON. При повреждённых сохранённых данных запись приостанавливается; **Export recovery copy** сохраняет исходные строки и доступное состояние памяти. Такая копия предназначена для ручного восстановления и не является обычным импортируемым JSON. После её сохранения очистите повреждённый набор через панель. Повреждённая сессия восстанавливается очисткой реального набора, поэтому сначала сохраните резервные копии.

### Live Presentation Mode

В боковом меню панели выберите **Live experiment**. Экран для проектора содержит название, число завершивших участников, доли по группам с `n`, разницу и философский тезис проекта. **Full screen** включает полноэкранный режим, где браузер его поддерживает.

**Reveal Experiment** раскрывает вопрос **WHAT IF YOUR CHOICE WAS NEVER TRULY YOURS?**, описание различий и осторожную интерпретацию выбранного набора. Равные доли, малая разница (< 5 п. п.) и отрицательная разница описываются корректно. Порог 5 п. п. служит только для словесного описания близких наблюдений; это не критерий статистической значимости. Тезис об автономии — авторская формулировка проекта, не цитата Канта или Фуко.

## Методика и формулы

```text
Library Choice Rate(g) = Library Votes(g) / Completed Votes(g) × 100
Difference = Library Choice Rate(B) − Library Choice Rate(A)
Confidence(g) = Sum of confidence scores(g) / Completed Votes(g)
Awareness share(g, answer) = Count(g, answer) / Completed Votes(g) × 100
```

Пустой знаменатель означает «нет данных». Округляется только отображение, расчёты используют исходные значения. `n` — количество завершённых анкет в данной группе, не число нажатий Start.

Для выборки около 40 человек это предварительные наблюдения учебного исследования. Разница процентов не доказывает причинность, статистическую значимость или отсутствие эффекта. В прототипе нет проверки гипотез и доверительных интервалов. Не используйте слово «доказано» по одному графику.

Комбинированное воздействие B не позволяет отдельно определить влияние цвета, рамки, кнопки или социальной подсказки. Фиксированный порядок вариантов может давать эффект позиции. Выбор в гипотетическом опросе не равен реальному бюджетному решению университета. Самоотчёт об уверенности не является объективным измерением автономии. Удобная выборка знакомых, различие языка, внешние обсуждения и знакомство с проектом ограничивают обобщение результатов.

## Project brief for the lecturer

### Social Problem

Digital interfaces may shape students' choices without their full awareness. The concrete target group is students at our university who routinely make decisions through digital services. Recruit an actual student group and state the recruitment method; the prototype contains no fabricated real findings.

### Research Question

To what extent can interface design influence the decisions students perceive as autonomous?

### Practical initiative and social impact

Participants make a low-risk hypothetical university preference decision, reflect on their independence, receive a debrief, and take away five ways to recognize persuasive interface design. The practical outputs are the working offline experiment, an anonymized dataset, descriptive comparisons, and the Digital Freedom Guide.

For a feasible teaching study, aim for around 40 voluntary students, approximately 20 per assigned group. Record actual completed sample sizes and withdrawals in aggregate without identifying individuals. The software does not supply the real research that the team must conduct.

Measure practical reach by the number who complete the experiment and receive the guide. For a stronger impact evaluation, conduct a separate short anonymous post-debrief discussion or structured observation of whether participants can identify an influence cue in a new example. Specify the rubric in advance and obtain consent for this additional activity. This optional impact measure is a fieldwork suggestion, not a feature implemented in the current app, and should not contaminate the pre-debrief A/B responses.

### Philosophical Framework

1. **Immanuel Kant — autonomy, independent judgment, rational choice.** Reflect on whether decisions follow one's own reasons. The experiment provides a prompt to examine autonomy; observed behavior cannot establish or refute Kant's account of freedom. Primary text for the team: *Groundwork of the Metaphysics of Morals* (1785), especially the discussion of autonomy in Section II.
2. **Michel Foucault — subtle power relations, influence and behavioral control.** Explore how arrangements of everyday environments can guide behavior. Applying this perspective to interface design is the project's interpretation, not a claim that Foucault analyzed modern buttons. Primary text for the team: *Discipline and Punish* (1975), Part Three.

The team should read the relevant passages and cite the edition used in its presentation. These are conceptual starting points, not verified quotations or a completed literature review.

### Ethical Reflection

- How ethical is it to influence participants through interface design?
- Can users provide meaningful consent when some details of an experiment are temporarily withheld?
- How should digital platforms balance persuasion and individual autonomy?

Protections: voluntary participation, advance notice, anonymity by design, no names/emails/IP collection, no network requests, a low-risk hypothetical choice, explanation after participation, clear disclosure that “Popular choice” is not verified, local withdrawal, and no penalty for leaving. Ask participants not to put identifying information into optional free text. The local researcher workspace has no authentication and should be supervised. Store exports securely and agree on a deletion date with the team.

Temporary withholding still creates an ethical tension: advance consent does not eliminate every concern. Explain why full advance disclosure would change the task, keep withholding minimal, debrief promptly and allow deletion after learning the method. Recruitment must avoid pressure from friends, teachers or grading relationships. Discuss residual risks such as embarrassment or distrust, and how supervision and respectful explanations reduce them.

### Digital Freedom Guide

1. Pause before following a highlighted recommendation.
2. Compare the wording and visibility of every option.
3. Question social cues such as “popular” or “recommended”.
4. Look for hidden alternatives and hard-to-find decline buttons.
5. Restate your own reasons before confirming a decision.

## Соответствие Endterm Guide и подготовка защиты

Guide рассматривает социальный проект как посильную практическую инициативу с философским анализом. Прототип связывает конкретную проблему студентов, собственное исследование, две философские перспективы, практический продукт и этическую рефлексию. **Наличие кода и демоданных не заменяет сбор собственных данных.**

| Критерий Guide | Что уже подготовлено | Что делает команда |
| --- | --- | --- |
| Real social problem — 15 | Цифровое влияние на выбор студентов | Описывает конкретную группу и примеры проблемы |
| Own data / research — 15 | Малый A/B-эксперимент и анкета | Набирает реальных добровольцев и собирает ответы |
| Philosophical analysis — 20 | Автономия и условия выбора; вопросы в debrief | Интерпретирует собственные данные, обсуждает пределы выводов |
| Philosophers / concepts — 15 | Кант и Фуко как две основы | Работает с первоисточниками и готовит ссылки на издания |
| Practical implementation and social impact — 20 | Рабочий сайт, панель, памятка | Проводит инициативу и описывает измеримый охват / результат |
| Ethical reflection — 15 | Согласие, debrief, отзыв, три вопроса | Обсуждает оправданность методики и оставшиеся риски |

В Guide указаны команда **4–5 студентов**, презентация **7–10 минут** и защита **7–10 минут**; оценка: **60% проект и презентация, 40% индивидуальная защита**. Для опроса как отдельного метода указано минимум 20 человек; малый эксперимент указан как самостоятельный допустимый метод. План на 40 участников — ориентир этого проекта, не выдуманное требование преподавателя.

Пример распределения 4–5 ролей: организация и этика; методика и проведение; данные и визуализации; философский анализ; продукт и демонстрация (при 4 участниках объедините две роли). Каждый должен уметь объяснить методику и ограничения самостоятельно.

Сценарий презентации на 8–9 минут: проблема и аудитория (1 мин), вопрос и две концепции (2 мин), методика и этика (1,5 мин), демонстрация и собственные результаты (2 мин), практический результат и ограничения (1,5 мин). Собирайте данные заранее; не пытайтесь провести 40 последовательных двухминутных сеансов внутри презентации. Для демонстрации механики разрешены явно помеченные демоданные, но выводы исследования делайте только по реальным.

## Архитектура и хранение

Встроенный JavaScript организован по зонам ответственности:

- `COPY`: полные словари EN/RU; выбор языка не меняет экспериментальную группу.
- `Store`: адаптер чтения/записи, отдельные наборы, защита повреждённых данных и память при сбое.
- `Experiment`: распределение, блокировка голоса, анкета, debrief, отзыв и новая сессия.
- `Statistics`: расчёты только по завершённым записям.
- `Backup`: CSV, версия JSON, строгая проверка импортируемых записей.
- Функции экранов и единый обработчик действий: participant, dashboard, live.

| Ключ localStorage | Назначение |
| --- | --- |
| `invisible-vote.real.v1` | Реальные записи и счётчики назначений |
| `invisible-vote.demo.v1` | Отдельные синтетические записи |
| `invisible-vote.session.v1` | Текущий анонимный ID, группа и этап |
| `invisible-vote.prefs.v1` | Выбранный язык |

Одна запись: случайный анонимный `id`, `group`, `option`, `status`, `synthetic`, `awareness`, `confidence`, `reason`. Имена, email, IP, отпечатки устройства и точное время ответа не собираются. В JSON фиксируется только время создания файла резервной копии. ID служит локальной связи голоса и анкеты, не идентификации человека.

Пользовательский текст экранируется при отображении; импорт не вставляет HTML. CSP запрещает сетевые соединения и загрузку внешних ресурсов. Контент, CSS и JS полностью встроены. Доступны клавиатурное управление, подписи полей, видимый фокус, удержание фокуса в подтверждениях и уменьшение анимации по системной настройке.

## Принципиальные ограничения офлайн-версии

1. Все результаты живут в одном браузере и его профиле. **Синхронного общего сбора голосов нет.**
2. Другой компьютер, смартфон, профиль или иногда другой путь к файлу получает отдельное хранилище. Поведение `localStorage` для `file://` зависит от браузера.
3. Очистка браузера, приватный режим, ограничения хранилища или перемещение файла могут привести к потере доступа. Сохраняйте JSON-копии вне хранилища браузера.
4. Панель не защищена паролем. Это исследовательский прототип для контролируемого устройства, не система разграничения доступа.
5. Голос блокируется в текущей сессии, но умышленное изменение файла, browser storage или создание новых профилей технически возможно.
6. Проектор отражает выбранный локальный набор. Он не получает ответы с телефонов автоматически.
7. Нет серверной базы, фиктивного QR-кода, онлайн-синхронизации или статистических тестов.

## Второй этап: настоящее онлайн-исследование

Потребуются размещённый HTTPS-сайт, серверный API, общая база результатов, серверное назначение групп и проверка завершённости, одноразовые анонимные токены и механизм отзыва, авторизация панели исследователя, резервное копирование и защита от повторных отправок. После этого можно добавить QR-код на адрес участия, смартфоны и обновление панели через polling/SSE/WebSocket.

Адаптер `Store` и обработчики `Experiment` можно перевести на асинхронный API; расчёты `Statistics` и представления сохранить. До запуска нужно определить сроки хранения, согласие и политику доступа, минимизировать серверные логи (они могут содержать IP) и проверить требования университета. Не следует обещать абсолютную анонимность без отдельной оценки серверной инфраструктуры.

## Проверка результата

Сценарии и фактические результаты проверки перечислены в `VERIFICATION.md`. Для самостоятельной проверки откройте сайт офлайн, протестируйте A и B через Session controls, завершите и удалите реальный пробный ответ, создайте демонабор, проверьте показатели и выполните круговой экспорт/импорт JSON. Перед настоящим сбором очистите только тестовые реальные ответы и убедитесь, что выбран **Real Data**.
