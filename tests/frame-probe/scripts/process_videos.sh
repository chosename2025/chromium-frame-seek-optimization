#!/bin/bash

# ==============================================================================
# Настройка путей
# ==============================================================================
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

INPUT_DIR="$PROJECT_ROOT/to_decode"
OUTPUT_DIR="$PROJECT_ROOT/public"
FRAMES_OUTPUT_DIR="$PROJECT_ROOT/public/frames"
FFMPEG_SCRIPT="$PROJECT_ROOT/scripts/ffmpeg.sh"
VIDEO_ARRAY_FILE="$PROJECT_ROOT/src/lib/videoArray.ts"

die() { echo "Ошибка: $1" >&2; exit 1; }

# Функция для получения параметров видео через ffprobe (надежный парсинг)
get_video_stats() {
    local video_path="$1"
    
    # Используем формат key=value, чтобы не зависеть от порядка вывода ffprobe
    local info=$(ffprobe -v error -select_streams v:0 \
        -show_entries stream=width,height,r_frame_rate,codec_name \
        -of flat "$video_path")
    
    # Извлекаем значения строго по ключам
    local width=$(echo "$info" | grep 'streams.stream.0.width' | sed 's/.*=\([0-9]*\).*/\1/')
    local height=$(echo "$info" | grep 'streams.stream.0.height' | sed 's/.*=\([0-9]*\).*/\1/')
    local fps_raw=$(echo "$info" | grep 'streams.stream.0.r_frame_rate' | sed 's/.*\"\([^"]*\)\".*/\1/')
    local codec=$(echo "$info" | grep 'streams.stream.0.codec_name' | sed 's/.*\"\([^"]*\)\".*/\1/')
    
    # Подсчет типов кадров (tr -d '\r' убирает возможные Windows-переносы строк;
    # awk безопасно возвращает 0 вместо пустой строки при отсутствии совпадений)
    local frames_csv
    frames_csv=$(ffprobe -v error -select_streams v:0 \
        -show_entries frame=pict_type -of csv=p=0 "$video_path" | tr -d '\r,')

    local frame_counts
    frame_counts=$(printf '%s\n' "$frames_csv" | awk '
        /^I$/ { i++ }
        /^P$/ { p++ }
        /^B$/ { b++ }
        NF    { t++ }
        END   { printf "%d %d %d %d", i+0, p+0, b+0, t+0 }
    ')
    local i_count p_count b_count total_count
    read -r i_count p_count b_count total_count <<< "$frame_counts"
    
    # Упрощаем FPS (например, 30/1 превращаем в 30)
    if [[ "$fps_raw" == */* ]]; then
        fps=$(echo "$fps_raw" | awk -F'/' '{printf "%.0f", $1/$2}')
    else
        fps="$fps_raw"
    fi

    echo "Кодек: $codec | Разрешение: ${width}x${height} | FPS: ${fps} | Всего кадров: ${total_count} (I: ${i_count}, P: ${p_count}, B: ${b_count})"
}

process_single_video() {
    local INPUT_PATH="$1"
    local FILENAME=$(basename "$INPUT_PATH")
    local NAME_NO_EXT="${FILENAME%.*}"
    
    local VARIANT_DIR="$FRAMES_OUTPUT_DIR/${NAME_NO_EXT}_test_variants"

    echo "Запуск ffmpeg.sh для: $INPUT_PATH"
    bash "$FFMPEG_SCRIPT" "$INPUT_PATH" "$VARIANT_DIR"

    if [ ! -f "$VARIANT_DIR/normal.mp4" ] || [ ! -f "$VARIANT_DIR/all_iframes.mp4" ] || [ ! -f "$VARIANT_DIR/all_pframes.mp4" ]; then
        echo "Ошибка: Один из вариантов видео не был создан. Пропуск..."
        return 1
    fi

    echo "Готово: $FILENAME"
    # Сохраняем путь к папке с вариантами
    LAST_PROCESSED_VIDEO="$VARIANT_DIR"
    return 0
}

generate_video_array() {
    local -a variant_dirs=("$@")
    
    printf "%s\n" "export interface VideoFrame {" > "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  id: number;" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  path: string;" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "}" >> "$VIDEO_ARRAY_FILE"
    printf "\n" >> "$VIDEO_ARRAY_FILE"
    
    printf "%s\n" "export interface VideoEntry {" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  name: string;" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  path: string;" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  gopType: \"normal\" | \"all_iframes\" | \"all_pframes\";" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  frames: VideoFrame[];" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "  description: string;" >> "$VIDEO_ARRAY_FILE"
    printf "%s\n" "}" >> "$VIDEO_ARRAY_FILE"
    printf "\n" >> "$VIDEO_ARRAY_FILE"
    
    printf "%s\n" "export const videoArray: VideoEntry[] = [" >> "$VIDEO_ARRAY_FILE"

    local first_entry=true
    
    # Обходим каждую успешно обработанную папку
    for variant_dir in "${variant_dirs[@]}"; do
        local base_name=$(basename "$variant_dir" | sed 's/_test_variants$//')
        
        # Для каждого типа GOP создаем отдельную запись в массиве
        for gop_type in "normal" "all_iframes" "all_pframes"; do
            local video_file="$variant_dir/${gop_type}.mp4"
            local frames_dir="$variant_dir/frames/${gop_type}"
            local web_video_path="/frames/$(basename "$variant_dir")/${gop_type}.mp4"
            
            # 1. Получаем описание через ffprobe
            local description=$(get_video_stats "$video_file")
            
            # 2. Собираем кадры
            local frames_json="[]"
            local frame_entries=()
            local frame_id=0
            
            if [ -d "$frames_dir" ]; then
                while IFS= read -r -d '' frame; do
                    local frame_basename=$(basename "$frame")
                    local rel_frame_path="/frames/$(basename "$variant_dir")/frames/${gop_type}/${frame_basename}"
                    
                    frame_entries+=("    {\"id\": ${frame_id}, \"path\": \"${rel_frame_path}\"}")
                    ((frame_id++))
                done < <(find "$frames_dir" -maxdepth 1 -name '*.png' -print0 | sort -zV)
            fi
            
            if [ ${#frame_entries[@]} -gt 0 ]; then
                frames_json="["
                for i in "${!frame_entries[@]}"; do
                    [ $i -gt 0 ] && frames_json+=","
                    frames_json+=$'\n'"${frame_entries[$i]}"
                done
                frames_json+=$'\n'"]"
            fi

            # 3. Пишем объект в TypeScript
            if [ "$first_entry" = true ]; then
                first_entry=false
            else
                printf "%s\n" "," >> "$VIDEO_ARRAY_FILE"
            fi

            printf "  {\n" >> "$VIDEO_ARRAY_FILE"
            printf "    name: \"%s\",\n" "$base_name" >> "$VIDEO_ARRAY_FILE"
            # Экранируем кавычки в путях и типах
            printf "    path: \"%s\",\n" "$web_video_path" >> "$VIDEO_ARRAY_FILE"
            printf "    gopType: \"%s\",\n" "$gop_type" >> "$VIDEO_ARRAY_FILE"
            printf "    frames: %s,\n" "$frames_json" >> "$VIDEO_ARRAY_FILE"
            printf "    description: \"%s\"\n" "$description" >> "$VIDEO_ARRAY_FILE"
            printf "  }" >> "$VIDEO_ARRAY_FILE"
        done
    done

    printf "\n%s\n" "];" >> "$VIDEO_ARRAY_FILE"
}

# ==============================================================================
# Проверки и запуск
# ==============================================================================
[ ! -f "$FFMPEG_SCRIPT" ] && die "Скрипт не найден: $FFMPEG_SCRIPT"
[ ! -d "$INPUT_DIR" ] && die "Папка с исходными видео не найдена: $INPUT_DIR"

# Проверяем наличие ffprobe
if ! command -v ffprobe &> /dev/null; then
    die "Утилита ffprobe не найдена. Установите ffmpeg (ffprobe входит в его состав)."
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$FRAMES_OUTPUT_DIR"

declare -a PROCESSED_VIDEOS=()

case "$1" in
    --all)
        echo "Обработка всех видео в $INPUT_DIR..."
        shopt -s nullglob
        VIDEO_FILES=("$INPUT_DIR"/*.mp4)
        shopt -u nullglob

        [ ${#VIDEO_FILES[@]} -eq 0 ] && die "В папке $INPUT_DIR не найдено .mp4 файлов."

        for VIDEO_FILE in "${VIDEO_FILES[@]}"; do
            echo "===== Обработка: $(basename "$VIDEO_FILE") ====="
            process_single_video "$VIDEO_FILE"
            [ $? -eq 0 ] && PROCESSED_VIDEOS+=("$LAST_PROCESSED_VIDEO")
        done
        echo "===== ВСЕ ВИДЕО ОБРАБОТАНО ====="
        ;;
    --single)
        [ -z "$2" ] && die "Укажите путь к видео для --single."
        SINGLE_INPUT_PATH="$INPUT_DIR/$2"
        [ ! -f "$SINGLE_INPUT_PATH" ] && die "Видеофайл не найден: $SINGLE_INPUT_PATH"

        process_single_video "$SINGLE_INPUT_PATH"
        [ $? -eq 0 ] && PROCESSED_VIDEOS+=("$LAST_PROCESSED_VIDEO")
        ;;
    *) die "Использование: $0 [--all|--single <путь>]" ;;
esac

if [ ${#PROCESSED_VIDEOS[@]} -gt 0 ]; then
    echo "Сбор метаданных и обновление $VIDEO_ARRAY_FILE..."
    generate_video_array "${PROCESSED_VIDEOS[@]}"
else
    echo "Нет успешно обработанных видео. $VIDEO_ARRAY_FILE не изменен."
fi

echo "===== ЗАВЕРШЕНО ====="