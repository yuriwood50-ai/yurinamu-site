# 유리나무 — 일러스트레이터 윤지영 소개 사이트

순수 HTML · CSS · JS로 만든 정적 사이트입니다. 빌드 과정 없이 파일 그대로 올리면 됩니다.

## 폴더 구조

| 경로 | 설명 |
|---|---|
| `index.html`, `illustration.html`, `webtoon.html`, `picturebook.html`, `class.html` | 메인 · 일러스트 · 웹툰·캐릭터 · 그림책 · 클래스 페이지 |
| `style.css` | 모든 스타일 (디자인 토큰은 맨 위 `:root`) |
| `assets/js/gallery.js` | `data/gallery.json`을 읽어 메인 히어로 이미지, 일러스트 그리드, 라이트박스를 만듦 |
| `assets/js/optimize-images.js` | 일러스트 원본 → 웹용·썸네일 이미지 + `gallery.json` 생성 (Node 스크립트, 사이트에서는 쓰지 않음) |
| `assets/images/illustration/` | 일러스트 **원본** (직접 넣는 곳 · 용량이 커서 Git에는 올리지 않음) |
| `assets/images/illustration-web/` | 스크립트가 만든 웹용 이미지 (직접 수정하지 않기) |
| `assets/images/webtoon/`, `assets/images/picturebook/` | 웹툰 대표 이미지 · 그림책 표지 (아직 없음 → 아래 자리표시자 참고) |
| `data/gallery.json` | 스크립트가 만든 일러스트 목록 (직접 수정하지 않기) |

## 1. 로컬에서 실행하기

HTML 파일을 더블클릭해서 열면(`file://`) 브라우저 보안 정책 때문에 `gallery.json`을 읽지 못해 **일러스트 이미지가 나오지 않습니다.** 반드시 로컬 서버로 여세요.

준비물: [Node.js](https://nodejs.org/) 20 이상

```bash
# 처음 한 번만 — sharp, http-server 설치
npm install

# 방법 A
npx serve .
# → http://localhost:3000

# 방법 B (package.json에 등록된 스크립트)
npm run preview
# → http://127.0.0.1:8080
```

끄려면 터미널에서 `Ctrl + C`를 누릅니다.

## 2. 일러스트 이미지 추가 · 교체하기

1. 원본(jpg/png)을 `assets/images/illustration/`에 넣습니다.
   파일명 **앞 두 자리 숫자가 표시 순서**입니다. 예: `64_I41.jpg`
2. 프로젝트 폴더에서 실행합니다.

   ```bash
   npm run optimize:images
   # (= node assets/js/optimize-images.js)
   ```

3. 결과
   - `assets/images/illustration-web/{원본이름}.jpg` — 긴 변 1600px, 품질 85
   - `assets/images/illustration-web/thumb_{원본이름}.jpg` — 600×600 정사각 썸네일
   - `data/gallery.json` — 파일명 순서대로 다시 작성
4. 브라우저를 새로고침하면 반영됩니다.

알아둘 점

- **01번 이미지**가 메인 히어로에, **01~06번**이 메인 일러스트 그리드에 나옵니다. 순서를 바꾸려면 파일명 숫자를 바꾸고 다시 실행하세요.
- 원본을 지워도 `illustration-web/`에 있던 예전 파일은 자동으로 지워지지 않습니다(`gallery.json`에서는 빠집니다). 필요하면 직접 지우세요.
- `01_A.jpg`와 `01_A.png`처럼 확장자만 다른 파일이 있으면 결과물이 겹치므로 스크립트가 멈춥니다.
- 원본 폴더(`assets/images/illustration/`)는 `.gitignore`로 GitHub에 올리지 않습니다. 다른 PC에서 작업하려면 원본을 따로 옮겨 오세요. 결과물(`illustration-web/`, `gallery.json`)은 커밋해야 사이트에 반영됩니다.
- 웹툰 대표 이미지 · 그림책 표지는 이 스크립트 대상이 아닙니다. 폭 1600px 이하로 줄여서 넣는 것을 권장합니다.

## 3. 자리표시자 목록

줄 번호는 편집하면 바뀌니 **검색어**로 찾는 것이 가장 정확합니다.

### 채워야 할 문구 — `[PLACEHOLDER_…]`

| 검색어 | 들어갈 내용 | 위치 |
|---|---|---|
| `[PLACEHOLDER_SSOMM_INTRO]` | 쏨쏨이 한 줄 소개 | `index.html:84`, `webtoon.html:58` |
| `[PLACEHOLDER_BOOK_INTRO_1]` | 『엄마가 아픈 날』 한 줄 소개 | `index.html:104`, `picturebook.html:51` |
| `[PLACEHOLDER_BOOK_INTRO_2]` | 『숲속세탁소』 한 줄 소개 | `index.html:120`, `picturebook.html:67` |
| `[PLACEHOLDER_CLASS_TOPICS]` | 수업 주제 | `class.html:54` |
| `[PLACEHOLDER_CLASS_TARGET]` | 수업 대상 | `class.html:61` |
| `[PLACEHOLDER_CLASS_FORMAT]` | 수업 형태 (온라인/오프라인, 회차, 인원 등) | `class.html:68` |
| `[PLACEHOLDER_CLASS_OUTCOME]` | 수업 결과물 | `class.html:75` |

`class.html`의 네 곳은 바로 위에 `<!-- 여기를 채우세요 -->` 주석이 있습니다.

### 넣어야 할 이미지 파일

아래 경로에 파일을 넣기만 하면 됩니다. 파일이 없는 동안에는 회색 칸에 "대표 이미지" / "표지 이미지"가 자동으로 표시됩니다.

| 파일 | 내용 · 비율 | 쓰이는 곳 |
|---|---|---|
| `assets/images/webtoon/eojjeoda.png` | 어쩌다ai 대표 이미지 · 가로 4:3 | `index.html`, `webtoon.html` |
| `assets/images/webtoon/ssomm.png` | 쏨쏨이 대표 이미지 · 가로 4:3 | `index.html`, `webtoon.html` |
| `assets/images/picturebook/mom.jpg` | 『엄마가 아픈 날』 표지 · 세로 4:5 | `index.html`, `picturebook.html` |
| `assets/images/picturebook/laundry.jpg` | 『숲속세탁소』 표지 · 세로 4:5 | `index.html`, `picturebook.html` |

비율이 달라도 칸에 맞춰 가운데 기준으로 잘려서 표시됩니다.

### 확인이 필요한 임시 문구 · 칸

실제 내용이 아니라 임시로 넣어 둔 것들입니다.

| 위치 | 내용 |
|---|---|
| `illustration.html:35` | 페이지 소개 "풍경과 인물, 일상의 장면을 따뜻한 색으로 담습니다." |
| `webtoon.html:34` | 페이지 소개 "짧은 이야기와 오래 곁에 두고 싶은 캐릭터를 만듭니다." |
| `picturebook.html:34` | 페이지 소개 "한 장면씩 넘기며 천천히 읽히는 이야기를 그립니다." |
| `webtoon.html:70–83` | 캐릭터 섹션 4칸 — "캐릭터 이미지" 칸과 "캐릭터 이름". 이미지는 `<div class="ph ph--portrait">…</div>`를 `<img class="ph ph--portrait" src="…" alt="…">`로 바꾸면 같은 비율(3:4)로 들어갑니다. |
| `assets/js/gallery.js` | 일러스트 이미지 대체 텍스트가 "유리나무 일러스트 1, 2, …" 번호로 되어 있습니다 (작품 제목 정보가 없어서). |
