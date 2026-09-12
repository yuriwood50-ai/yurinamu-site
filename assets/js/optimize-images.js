/**
 * 일러스트 이미지 최적화
 *
 *   assets/images/illustration/*.{jpg,png}
 *     → assets/images/illustration-web/{이름}.jpg        (긴 변 1600px, 품질 85)
 *     → assets/images/illustration-web/thumb_{이름}.jpg  (600×600 정사각)
 *     → data/gallery.json  [{ id, full, thumb }]  (파일명 앞 숫자 순)
 *
 * 실행: npm run optimize:images  (또는 node assets/js/optimize-images.js)
 */
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT, "assets/images/illustration");
const OUT_DIR = path.join(ROOT, "assets/images/illustration-web");
const DATA_FILE = path.join(ROOT, "data/gallery.json");

const FULL_SIZE = 1600;
const THUMB_SIZE = 600;
const QUALITY = 85;

// HTML에서 바로 쓸 수 있도록 사이트 루트 기준 경로로 기록
const WEB_PREFIX = "assets/images/illustration-web";

const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";

function jpeg(pipeline) {
  // PNG 투명 영역은 흰 배경으로 채워서 jpg로 저장
  return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: QUALITY, mozjpeg: true });
}

async function main() {
  const files = (await fs.readdir(SRC_DIR))
    .filter((name) => /\.(jpe?g|png)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    throw new Error(`원본 이미지가 없습니다: ${SRC_DIR}`);
  }

  // 01_A.jpg / 01_A.png 처럼 확장자만 다른 파일은 결과물이 서로 덮어쓰므로 중단
  const seen = new Set();
  for (const name of files) {
    const base = path.parse(name).name;
    if (seen.has(base)) throw new Error(`확장자만 다른 중복 파일명: ${base}`);
    seen.add(base);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  const gallery = [];
  let srcBytes = 0;
  let fullBytes = 0;
  let thumbBytes = 0;

  for (const [i, name] of files.entries()) {
    const base = path.parse(name).name;
    const src = path.join(SRC_DIR, name);
    const fullName = `${base}.jpg`;
    const thumbName = `thumb_${base}.jpg`;

    // .rotate(): EXIF 방향 정보를 반영한 뒤 메타데이터 제거
    const full = await jpeg(
      sharp(src)
        .rotate()
        .resize(FULL_SIZE, FULL_SIZE, { fit: "inside", withoutEnlargement: true })
    ).toFile(path.join(OUT_DIR, fullName));

    // attention: 채도·밝기가 두드러진 부분을 중심으로 크롭 (가운데 고정은 "centre")
    const thumb = await jpeg(
      sharp(src)
        .rotate()
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: sharp.strategy.attention })
    ).toFile(path.join(OUT_DIR, thumbName));

    const { size } = await fs.stat(src);
    srcBytes += size;
    fullBytes += full.size;
    thumbBytes += thumb.size;

    gallery.push({
      id: base,
      full: `${WEB_PREFIX}/${fullName}`,
      thumb: `${WEB_PREFIX}/${thumbName}`,
    });

    console.log(
      `[${String(i + 1).padStart(2)}/${files.length}] ${name}  ${toMB(size)} → ${toMB(full.size)} (${full.width}×${full.height}) + thumb ${(thumb.size / 1024).toFixed(0)} KB`
    );
  }

  await fs.writeFile(DATA_FILE, JSON.stringify(gallery, null, 2) + "\n", "utf8");

  const outBytes = fullBytes + thumbBytes;
  const pct = (n) => ((1 - n / srcBytes) * 100).toFixed(1) + "%";
  console.log("\n처리 완료:", gallery.length, "장");
  console.log("원본 합계        :", toMB(srcBytes));
  console.log("웹용(1600) 합계  :", toMB(fullBytes), `(원본 대비 ${pct(fullBytes)} 감소)`);
  console.log("썸네일 합계      :", toMB(thumbBytes));
  console.log("웹용+썸네일 합계 :", toMB(outBytes), `(원본 대비 ${pct(outBytes)} 감소)`);
  console.log("gallery.json     :", path.relative(ROOT, DATA_FILE));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
