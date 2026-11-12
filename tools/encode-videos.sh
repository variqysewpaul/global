#!/usr/bin/env bash
# Encodes the armed response vehicle clip for the site (needs ffmpeg with libx264 and libwebp; works in Git Bash, macOS, Linux).
#
#   bash tools/encode-videos.sh "path/to/clip.mp4"
#
# Writes public/video/vehicle-1.mp4, vehicle-1-sm.mp4, vehicle-2.mp4, vehicle-2-sm.mp4 and a poster (.webp) for each.
#
# Why it is done this way (this is what keeps the picture sharp):
#   - The page shows the clip in a TALL panel ("Our approach", first half of the clip) and a WIDE band (closing, second half).
#     A browser would crop the 16:9 frame to that shape and then enlarge it with a soft bilinear filter, which is what made the
#     footage look blurry. Here the crop is made once, in the file, and the picture is enlarged with Lanczos (far cleaner) and a
#     light contrast-adaptive sharpen, so the browser has little or nothing left to enlarge.
#   - A light temporal denoise goes first: generated footage carries a shimmer that sharpening would exaggerate and that costs a
#     lot of bits to keep, so removing it gives a cleaner picture in a smaller file.
#   - Each half plays forward then backward, so the loop has no jump.
#   - Quality is set by CRF (lower is better and bigger). A small version is made for phones and low-density screens;
#     src/video.js picks the file by how many real pixels the picture needs on the visitor's screen.
#   - Source colour tags are left untouched, so the colours match the original file.
#
# The source clip is 1280x720, so the real detail is limited to that. For a really crisp result, export the clip from the
# generator at 1080p or 4K and run this script again: everything adapts to the source size.
#
# Tuning (environment variables): PHIL_X (left edge of the tall crop as a fraction of the width, default 0.28),
# CLOSE_Y (top edge of the wide crop as a fraction of the height, default 0.14), CAS (sharpen strength 0-1, default 0.55),
# DENOISE (an ffmpeg filter, default hqdn3d=1.5:1.5:6:6; set it empty to switch it off), CRF / CRF_SM (default 22 / 24),
# HALF (seconds per half, default 5), OUT (default public/video).
set -euo pipefail

SRC="${1:?usage: bash tools/encode-videos.sh path/to/clip.mp4}"
OUT="${OUT:-public/video}"
PHIL_X="${PHIL_X:-0.28}"
CLOSE_Y="${CLOSE_Y:-0.14}"
CAS="${CAS:-0.55}"
DENOISE="${DENOISE-hqdn3d=1.5:1.5:6:6}"
CRF="${CRF:-22}"
CRF_SM="${CRF_SM:-24}"
HALF="${HALF:-5}"

mkdir -p "$OUT"
probe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$1" -of default=noprint_wrappers=1:nokey=1 "$SRC"; }
SW=$(probe width)
SH=$(probe height)
FPS=$(probe r_frame_rate | awk '{split($1, f, "/"); print (f[2] ? f[1] / f[2] : f[1])}')
FRAMES=$(awk -v f="$FPS" -v h="$HALF" 'BEGIN{printf "%d", f*h + 0.5}')
echo "source ${SW}x${SH} @ ${FPS} fps, ${FRAMES} frames per half"

even() { echo $(($1 / 2 * 2)); }

# crops (in source pixels): tall = 0.87 : 1, wide = 2.31 : 1, phone wide = 1.45 : 1
TALL_W=$(even "$(awk -v h="$SH" 'BEGIN{printf "%d", h*0.87}')")
TALL_X=$(awk -v w="$SW" -v c="$TALL_W" -v x="$PHIL_X" 'BEGIN{v=int(w*x); if (v > w-c) v=w-c; print v}')
WIDE_H=$(even "$(awk -v w="$SW" 'BEGIN{printf "%d", w/2.31}')")
WIDE_Y=$(awk -v h="$SH" -v c="$WIDE_H" -v y="$CLOSE_Y" 'BEGIN{v=int(h*y); if (v > h-c) v=h-c; print v}')
PHONE_W=$(even "$(awk -v h="$SH" 'BEGIN{printf "%d", h*1.45}')")
PHONE_X=$(((SW - PHONE_W) / 2))
[ "$WIDE_H" -le "$SH" ] || { WIDE_H=$SH; WIDE_Y=0; }
[ "$PHONE_W" -le "$SW" ] || { PHONE_W=$SW; PHONE_X=0; }

# make NAME START CROP(w:h:x:y) OUT_W OUT_H CRF
make() {
  local name=$1 start=$2 crop=$3 w=$4 h=$5 crf=$6
  local chain="crop=${crop},${DENOISE:+${DENOISE},}scale=${w}:${h}:flags=lanczos+accurate_rnd+full_chroma_int,cas=${CAS},format=yuv420p"
  echo "-> $name (${w}x${h}, crf ${crf})"
  # one half (exactly FRAMES frames), forward, then backward without repeating the two frames at the turn, so it loops cleanly
  ffmpeg -y -hide_banner -loglevel error -ss "$start" -i "$SRC" -an \
    -filter_complex "[0:v]trim=end_frame=${FRAMES},setpts=PTS-STARTPTS,${chain},split[f][b];[b]reverse,trim=start_frame=1:end_frame=$((FRAMES - 1)),setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1:a=0[v]" \
    -map "[v]" -c:v libx264 -preset slower -tune film -crf "$crf" -profile:v high -level 4.1 -pix_fmt yuv420p -r "$FPS" -movflags +faststart "$OUT/$name.mp4"
  ffmpeg -y -hide_banner -loglevel error -ss "$start" -i "$SRC" -frames:v 1 -vf "$chain" -c:v libwebp -quality 86 -compression_level 6 "$OUT/$name.webp"
}

# first half: the tall panel (the vehicle's side and livery)
make vehicle-1    0       "${TALL_W}:${SH}:${TALL_X}:0" 960 1104 "$CRF"
make vehicle-1-sm 0       "${TALL_W}:${SH}:${TALL_X}:0" 720 828 "$CRF_SM"
# second half: the wide closing band
make vehicle-2    "$HALF" "${SW}:${WIDE_H}:0:${WIDE_Y}" 1600 694 "$CRF"
make vehicle-2-sm "$HALF" "${PHONE_W}:${SH}:${PHONE_X}:0" 720 496 "$CRF_SM"

ls -l "$OUT"/vehicle-*
