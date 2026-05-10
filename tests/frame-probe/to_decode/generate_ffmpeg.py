#!/usr/bin/env python3
"""Generate popixelny test videos via ffmpeg.

Each frame: all black, one white pixel. Pixel moves in raster order (L->R, T->B).
Total frames = width * height, so each pixel is shown for exactly 1/fps seconds.
"""
import io, subprocess, os, sys
from PIL import Image

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

PRESETS = [
    (4,   4,   2),
    (8,   8,   4),
    (16,  16,  10),
    (32,  32,  15),
    (64,  64,  24),
    (128, 128, 30),
]

CODECS = [
    ('H.264', 'mp4',  ['-c:v', 'libx264', '-preset', 'ultrafast', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p']),
    ('VP9',   'webm', ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30']),
]


def generate_frame_png(w, h, pixel_idx):
    img = Image.new('RGB', (w, h), (0, 0, 0))
    if pixel_idx < w * h:
        x = pixel_idx % w
        y = pixel_idx // w
        img.putpixel((x, y), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def encode_video(w, h, fps, codec_name, ext, extra_args, output_path):
    n = w * h
    print(f'  Encoding {n} frames @ {fps}fps -> {codec_name}/{ext} ...', flush=True, end=' ')

    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-f', 'image2pipe', '-vcodec', 'png', '-framerate', str(fps),
        '-i', '-',
        '-frames:v', str(n),
        '-r', str(fps),
        '-an',
    ] + extra_args + [output_path]

    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    for i in range(n):
        png = generate_frame_png(w, h, i)
        proc.stdin.write(png)

    proc.stdin.close()
    ret = proc.wait()

    if ret == 0:
        size = os.path.getsize(output_path)
        print(f'Done  ({size / 1024:.1f} KB)', flush=True)
    else:
        print(f'FAILED (exit {ret})', flush=True)


def main():
    for w, h, fps in PRESETS:
        n = w * h
        dur = n / fps
        print(f'\nPreset {w}x{h} @ {fps} fps — {n} frames, {dur:.1f}s duration')
        for codec_name, ext, args in CODECS:
            out_name = f'pixel_{w}x{h}_{fps}fps_{codec_name}.{ext}'
            out_path = os.path.join(OUT_DIR, out_name)
            encode_video(w, h, fps, codec_name, ext, args, out_path)

    print('\n\nAll done!')


if __name__ == '__main__':
    main()
