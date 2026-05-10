#!/bin/bash

# ==============================================================
# Скрипт для генерации вариантов видео с разной структурой GOP
# ==============================================================

# Проверка аргументов (теперь принимаем 2: входной файл и куда сохранять)
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "Использование: $0 <путь_к_входному_видео> [папка_назначения]"
    echo "Пример: $0 input.mp4 ./public/frames/video_test_variants"
    exit 1
fi

INPUT_VIDEO="$1"
# Если папка назначения указана - используем её, иначе создаем рядом с видео
DEST_DIR="$2"

if [ ! -f "$INPUT_VIDEO" ]; then
    echo "Ошибка: Файл '$INPUT_VIDEO' не найден!"
    exit 1
fi

BASENAME=$(basename "$INPUT_VIDEO" | sed 's/\.[^.]*$//')
OUTPUT_DIR="${DEST_DIR:-${BASENAME}_test_variants}"

echo "=================================================="
echo "Создание директории: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ----------------------------------------------------------
# 1. NORMAL
# ----------------------------------------------------------
echo "[1/6] Кодирование: normal (стандартный GOP)..."
ffmpeg -y -i "$INPUT_VIDEO" -c:v libx264 -preset medium -crf 23 -g 250 -keyint_min 25 -c:a aac "$OUTPUT_DIR/normal.mp4" -loglevel warning

# ----------------------------------------------------------
# 2. ALL_IFRAMES
# ----------------------------------------------------------
echo "[2/6] Кодирование: all_iframes (только ключевые кадры)..."
ffmpeg -y -i "$INPUT_VIDEO" -c:v libx264 -preset fast -crf 18 -g 1 -c:a aac "$OUTPUT_DIR/all_iframes.mp4" -loglevel warning

# ----------------------------------------------------------
# 3. ALL_PFRAMES
# ----------------------------------------------------------
echo "[3/6] Кодирование: all_pframes (только P-кадры)..."
ffmpeg -y -i "$INPUT_VIDEO" -c:v libx264 -preset fast -crf 23 -g 10000 -keyint_min 10000 -sc_threshold 0 -c:a aac "$OUTPUT_DIR/all_pframes.mp4" -loglevel warning

# ----------------------------------------------------------
# 4. Извлечение кадров (FRAMES)
# ----------------------------------------------------------
FRAMES_DIR="$OUTPUT_DIR/frames"
mkdir -p "$FRAMES_DIR/normal"
mkdir -p "$FRAMES_DIR/all_iframes"
mkdir -p "$FRAMES_DIR/all_pframes"

echo "[4/6] Извлечение кадров из normal..."
# Добавил out_time_ms для точного таймстемпа в миллисекундах
ffmpeg -y -i "$OUTPUT_DIR/normal.mp4" -vsync vfr -frame_pts 1 "$FRAMES_DIR/normal/frame_%05d.png" -loglevel warning

echo "[5/6] Извлечение кадров из all_iframes..."
ffmpeg -y -i "$OUTPUT_DIR/all_iframes.mp4" -vsync vfr -frame_pts 1 "$FRAMES_DIR/all_iframes/frame_%05d.png" -loglevel warning

echo "[6/6] Извлечение кадров из all_pframes..."
ffmpeg -y -i "$OUTPUT_DIR/all_pframes.mp4" -vsync vfr -frame_pts 1 "$FRAMES_DIR/all_pframes/frame_%05d.png" -loglevel warning

echo "=================================================="
echo "ГОТОВО! Все файлы сохранены в папке: $OUTPUT_DIR/"
echo "=================================================="