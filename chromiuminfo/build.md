# Руководство по работе с репозиторием Chromium на Ubuntu

> **Источник:** [Chromium Repository](https://github.com/chromium/chromium)  
> **Официальная документация:** [Linux Build Instructions](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/build_instructions.md)  
> **Процесс внесения изменений:** [Contributing Guide](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/contributing.md)

## Содержание

1. [Системные требования](#системные-требования)
2. [Получение исходного кода](#получение-исходного-кода)
3. [Установка зависимостей](#установка-зависимостей)
4. [Настройка сборки](#настройка-сборки)
5. [Сборка Chromium](#сборка-chromium)
6. [Запуск и тестирование](#запуск-и-тестирование)
7. [Внесение изменений](#внесение-изменений)
8. [Проверка решения](#проверка-решения)
9. [Полезные ссылки](#полезные-ссылки)

---

## Системные требования

### Минимальные требования

| Компонент | Требования |
|-----------|------------|
| **ОС** | Ubuntu 22.04 LTS (Jammy Jellyfish) — официально поддерживаемый дистрибутив |
| **Архитектура** | x86-64 (64-бит) |
| **RAM** | Минимум 8 ГБ, рекомендуется ≥16 ГБ |
| **Дисковое пространство** | ≥100 ГБ свободного места (для исходников, зависимостей и промежуточных файлов) |
| **Python** | Версия ≥3.9 (Python 3.11 используется внутри инфраструктуры) |
| **Компилятор** | Clang + libc++ (рекомендуется), GCC поддерживается сообществом |

### Рекомендации

- **SSD** предпочтительнее HDD для ускорения сборки
- **Многоядерный процессор** значительно ускорит компиляцию
- **Стабильное интернет-соединение** для загрузки зависимостей

---

## Получение исходного кода

### Шаг 1: Установка depot_tools

`depot_tools` — набор инструментов для работы с репозиторием Chromium.

```bash
# Клонирование depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git

# Добавление в PATH (временно)
export PATH="$PWD/depot_tools:$PATH"

# Добавление в PATH постоянно (добавьте в ~/.bashrc или ~/.zshrc)
echo 'export PATH="/path/to/depot_tools:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Шаг 2: Клонирование репозитория Chromium

```bash
# Создание рабочей директории
mkdir ~/chromium
cd ~/chromium

# Получение исходного кода (без автоматических хуков)
fetch --nohooks chromium

# Переход в директорию с исходниками
cd src
```

**Примечание:** Если полная история коммитов не нужна, используйте флаг `--no-history` для ускорения скачивания:
```bash
fetch --nohooks --no-history chromium
```

---

## Установка зависимостей

### Автоматическая установка зависимостей

Chromium предоставляет скрипт для автоматической установки всех необходимых библиотек и инструментов:

```bash
cd src
./build/install-build-deps.sh
```

Этот скрипт установит:
- GTK и связанные библиотеки
- NSPR, NSS
- Другие системные зависимости

### Запуск хуков

После установки зависимостей необходимо запустить хуки, которые подготовят конфигурацию и загрузят дополнительные компоненты:

```bash
gclient runhooks
```

---

## Настройка сборки

### Генерация файлов сборки

Chromium использует систему сборки **GN** (Generate Ninja) для генерации файлов сборки:

```bash
# Генерация файлов сборки в директории out/Default
gn gen out/Default
```

### Настройка параметров сборки

Для изменения параметров сборки используйте:

```bash
gn args out/Default
```

Это откроет редактор, где можно указать параметры. Типичные настройки:

```python
# Режим сборки
is_debug = false              # false = Release, true = Debug
is_component_build = true     # Раздельные библиотеки для ускорения линковки

# Уровень отладочной информации
symbol_level = 1              # 0 = нет символов, 1 = минимальные, 2 = полные

# Оптимизации сборки
use_remoteexec = true         # Использовать удалённое выполнение (если доступно)
use_siso = true               # Использовать Siso для ускорения сборки
```

**Примечание:** Для разработки и отладки рекомендуется использовать `is_debug = true` и `symbol_level = 1`.

---

## Сборка Chromium

### Полная сборка браузера

```bash
# Сборка основного исполняемого файла chrome
autoninja -C out/Default chrome
```

`autoninja` — обёртка, которая автоматически выбирает оптимальный способ сборки (Siso или Ninja).

### Сборка отдельных компонентов

Для сборки конкретных целей:

```bash
# Просмотр доступных целей
gn ls out/Default

# Сборка конкретной цели
autoninja -C out/Default <target>

# Примеры:
autoninja -C out/Default unit_tests
autoninja -C out/Default browser_tests
autoninja -C out/Default media_unittests  # Для тестирования медиа-компонентов
```

### Ускорение сборки

1. **Использование ccache:**
   ```bash
   # В args.gn добавьте:
   cc_wrapper = "ccache"
   ```

2. **Монтирование output-каталога на tmpfs** (если достаточно RAM):
   ```bash
   sudo mount -t tmpfs -o size=20G tmpfs out/Default
   ```

3. **Использование Remote Execution** (требует настройки):
   - Настройте `use_remoteexec = true` в `args.gn`
   - Требуется доступ к серверу Remote Execution

---

## Запуск и тестирование

### Запуск собранного браузера

```bash
# Запуск Chromium
./out/Default/chrome

# Запуск с дополнительными флагами (для отладки)
./out/Default/chrome --enable-logging=stderr --vmodule=media=2
```

### Запуск тестов

#### Юнит-тесты

```bash
# Сборка юнит-тестов
autoninja -C out/Default unit_tests

# Запуск всех юнит-тестов
./out/Default/unit_tests

# Запуск с фильтром (только определённые тесты)
./out/Default/unit_tests --gtest_filter="MediaTest.*"
```

#### Browser-тесты

```bash
# Сборка browser-тестов
autoninja -C out/Default browser_tests

# Запуск browser-тестов
./out/Default/browser_tests
```

#### Медиа-специфичные тесты

Для тестирования изменений в медиа-компонентах:

```bash
# Сборка медиа-тестов
autoninja -C out/Default media_unittests

# Запуск медиа-тестов
./out/Default/media_unittests --gtest_filter="*Seek*"
```

#### Web-тесты Blink

```bash
# Сборка web-тестов
autoninja -C out/Default blink_tests

# Запуск web-тестов
third_party/blink/tools/run_web_tests.py --debug
```

### Тестирование в headless режиме

Если нет графического окружения, используйте `Xvfb`:

```bash
# Установка Xvfb
sudo apt-get install xvfb

# Запуск тестов через Xvfb
xvfb-run ./out/Default/browser_tests
```

### Отладка медиа-компонентов

Для отладки проблем с видео используйте:

1. **chrome://media-internals** — страница с внутренними логами медиа-компонентов
2. **DVLOG** — логирование в коде (см. `chromiuminfo/archtecture.md`)
3. **Флаги запуска:**
   ```bash
   ./out/Default/chrome --enable-logging=stderr --vmodule=media=2
   ```

---

## Внесение изменений

### Шаг 1: Создание ветки

```bash
# Обновление до последней версии
git fetch origin
git checkout origin/main

# Создание новой ветки для изменений
git checkout -b feature/frame-seek-optimization
```

### Шаг 2: Внесение изменений

1. Отредактируйте необходимые файлы
2. Убедитесь, что код соответствует стилю проекта:
   ```bash
   # Проверка форматирования
   git cl format
   ```

### Шаг 3: Проверка сборки

```bash
# Убедитесь, что код компилируется
autoninja -C out/Default chrome

# Запустите релевантные тесты
./out/Default/media_unittests --gtest_filter="*Seek*"
```

### Шаг 4: Коммит изменений

```bash
# Добавление изменений
git add <изменённые_файлы>

# Создание коммита
git commit -m "Оптимизация покадровой перемотки HTMLVideoElement

Описание изменений:
- Улучшена производительность seeking
- Добавлена поддержка кэширования I-фреймов
- Оптимизирован алгоритм поиска кадров

Bug: <номер_бага_если_есть>
Test: Запущены media_unittests, проверена производительность"
```

**Важно:** В описании коммита используйте тег `Test:` для указания способа проверки изменений.

### Шаг 5: Отправка на код-ревью

Chromium использует **Gerrit** для код-ревью (не GitHub Pull Requests):

```bash
# Загрузка изменений на обзор
git cl upload

# Указание ревьюеров (найдите в файлах OWNERS)
git cl upload --reviewers=reviewer@chromium.org
```

**Примечание:** Перед отправкой необходимо подписать **Contributor License Agreement (CLA)**.

### Шаг 6: CQ Dry Run

Перед финальным коммитом запустите "пробную" сборку через try bots:

```bash
# Запуск CQ Dry Run
git cl try

# Или с указанием конкретных ботов
git cl try -B chromium/try \
    -b linux_chromium_dbg_ng \
    -b win_chromium_dbg_ng \
    -b mac_chromium_dbg_ng
```

Это проверит, что ваши изменения компилируются и проходят тесты на разных платформах.

### Шаг 7: Получение одобрения и коммит

1. Дождитесь одобрения от ревьюеров (статус "LGTM" — Looks Good To Me)
2. После получения LGTM и успешного прохождения CQ Dry Run нажмите **"SUBMIT TO CQ"** в интерфейсе Gerrit
3. Commit Queue автоматически вольёт изменения после успешной проверки всеми ботами

---

## Проверка решения

### Локальная проверка

1. **Сборка без ошибок:**
   ```bash
   autoninja -C out/Default chrome
   ```

2. **Запуск релевантных тестов:**
   ```bash
   # Тесты для медиа-компонентов
   ./out/Default/media_unittests --gtest_filter="*Seek*"
   
   # Browser-тесты
   ./out/Default/browser_tests --gtest_filter="*Video*"
   ```

3. **Ручное тестирование:**
   - Запустите браузер: `./out/Default/chrome`
   - Откройте тестовую HTML-страницу с видео
   - Проверьте производительность seeking через DevTools
   - Проверьте логи в `chrome://media-internals`

### Проверка производительности

Для задачи оптимизации покадровой перемотки важно проверить:

1. **Время выполнения seeking:**
   - Измерьте время между вызовами `video.currentTime = ...`
   - Сравните с производительностью до оптимизации

2. **Использование памяти:**
   - Проверьте, что оптимизация не увеличивает потребление памяти
   - Используйте DevTools Memory Profiler

3. **Корректность работы:**
   - Убедитесь, что все кадры отображаются правильно
   - Проверьте работу с разными форматами видео (MP4, WebM и т.д.)

### Автоматическая проверка через CI

После отправки CL на обзор:

1. **CQ Dry Run** проверит сборку и тесты на разных платформах
2. **Try bots** запустят полный набор тестов
3. Проверьте результаты в интерфейсе Gerrit

### Чек-лист перед отправкой

- [ ] Код компилируется без ошибок и предупреждений
- [ ] Все релевантные тесты проходят локально
- [ ] Код соответствует стилю проекта (проверено через `git cl format`)
- [ ] Добавлены/обновлены тесты для новых изменений
- [ ] Обновлена документация (если необходимо)
- [ ] Описание коммита содержит тег `Test:` с инструкциями по проверке
- [ ] Запущен CQ Dry Run и все проверки прошли успешно

---

## Полезные ссылки

### Официальная документация

- **Репозиторий Chromium:** [github.com/chromium/chromium](https://github.com/chromium/chromium)
- **Инструкции по сборке на Linux:** [chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/build_instructions.md](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/build_instructions.md)
- **Руководство по внесению изменений:** [chromium.googlesource.com/chromium/src/+/HEAD/docs/contributing.md](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/contributing.md)
- **Получение кода:** [chromium.org/developers/how-tos/get-the-code](https://www.chromium.org/developers/how-tos/get-the-code)

### Инструменты и утилиты

- **depot_tools:** [chromium.googlesource.com/chromium/tools/depot_tools](https://chromium.googlesource.com/chromium/tools/depot_tools)
- **GN Build Configuration:** [chromium.org/developers/gn-build-configuration](https://www.chromium.org/developers/gn-build-configuration)
- **Running Tests:** [chromium.org/developers/testing/running-tests](https://www.chromium.org/developers/testing/running-tests)

### Процесс разработки

- **Code Reviews:** [chromium.org/chromium-os/developer-library/guides/code-review/code-reviews-and-submitting-code](https://www.chromium.org/chromium-os/developer-library/guides/code-review/code-reviews-and-submitting-code)
- **Gerrit Code Review:** [chromium-review.googlesource.com](https://chromium-review.googlesource.com)
- **Commit Queue:** [chromium.googlesource.com/chromium/src/+/HEAD/docs/infra/commit_queue.md](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/infra/commit_queue.md)

### Медиа-компоненты (релевантно для задачи)

- **Media README:** [chromium.googlesource.com/chromium/src/+/HEAD/media/README.md](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md)
- **HTMLVideoElement Documentation:** [developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement)

---

## Часто встречающиеся проблемы

### Проблема: Отсутствует файл `build.ninja`

**Решение:** Выполните генерацию файлов сборки:
```bash
gn gen out/Default
```

### Проблема: Ошибки линковки из-за нехватки памяти

**Решение:**
- Уменьшите уровень символов: `symbol_level = 0` в `args.gn`
- Используйте Release режим: `is_debug = false`
- Используйте component build: `is_component_build = true`

### Проблема: Медленная сборка

**Решение:**
- Используйте `ccache`
- Настройте Remote Execution (если доступно)
- Монтируйте `out/Default` на tmpfs (если достаточно RAM)
- Используйте `autoninja` вместо `ninja`

### Проблема: Ошибки при запуске тестов

**Решение:**
- Убедитесь, что все зависимости установлены: `./build/install-build-deps.sh`
- Проверьте, что тесты собраны: `autoninja -C out/Default <test_target>`
- Для headless режима используйте `xvfb-run`

---

**Последнее обновление:** 2026  
**Версия документа:** 1.0
