#!/bin/sh
# Tira de N fotogramas repartidos por el vídeo + volumen del audio, para revisar un resultado de vídeo.
# uso: vstrip.sh video.mp4 salida.jpg [n_fotogramas=4]
n=${3:-4}; f=$(ffprobe -v error -select_streams v -count_frames -show_entries stream=width,height,nb_read_frames -of csv=p=0 "$1")
echo "$1: $f (w,h,frames)"; tot=$(echo $f | cut -d, -f3)
sel=$(python3 -c "n=$n;t=$tot;print('+'.join(f'eq(n,{round(i*(t-1)/(n-1))})' for i in range(n)))")
ffmpeg -v error -y -i "$1" -vf "select='$sel',scale=-1:300,tile=${n}x1" -fps_mode vfr -frames:v 1 "$2"
ffmpeg -hide_banner -i "$1" -af volumedetect -f null /dev/null 2>&1 | grep -o -E '(mean|max)_volume: [-0-9.]+ dB' | tr '\n' ' '; echo
