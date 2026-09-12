/**
 * 갤러리 — data/gallery.json 을 읽어 이미지를 채우고 라이트박스를 연결
 *
 *   <div data-gallery-hero>          첫 번째 이미지(full)
 *   <ul data-gallery>                전체를 썸네일 그리드로
 *   <ul data-gallery data-limit="6"> 앞에서부터 6장만
 *
 * fetch를 쓰므로 HTML 파일을 더블클릭(file://)으로 열면 목록을 못 불러옵니다.
 * 로컬에서는 `npm run preview` 로 확인하세요.
 */
(() => {
  const DATA_URL = "data/gallery.json";

  const heroEl = document.querySelector("[data-gallery-hero]");
  const gridEls = [...document.querySelectorAll("[data-gallery]")];
  if (!heroEl && gridEls.length === 0) return;

  const altFor = (index) => `유리나무 일러스트 ${index + 1}`;

  /* ---------- 라이트박스 ---------- */
  function createLightbox() {
    const root = document.createElement("div");
    root.className = "lightbox";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "작품 크게 보기");
    root.innerHTML = `
      <img class="lightbox-img" alt="">
      <button type="button" class="lightbox-btn lightbox-close" aria-label="닫기">×</button>
      <button type="button" class="lightbox-btn lightbox-prev" aria-label="이전 작품">←</button>
      <button type="button" class="lightbox-btn lightbox-next" aria-label="다음 작품">→</button>
      <p class="lightbox-counter" aria-live="polite"></p>
    `;
    document.body.append(root);

    const img = root.querySelector(".lightbox-img");
    const closeBtn = root.querySelector(".lightbox-close");
    const prevBtn = root.querySelector(".lightbox-prev");
    const nextBtn = root.querySelector(".lightbox-next");
    const counter = root.querySelector(".lightbox-counter");

    let items = [];
    let current = 0;
    let opener = null;

    const wrap = (index) => (index + items.length) % items.length;

    function show(index) {
      current = wrap(index);
      img.src = items[current].full;
      img.alt = altFor(current);
      counter.textContent = `${current + 1} / ${items.length}`;
      // 앞뒤 이미지를 미리 받아 넘길 때 바로 보이게
      new Image().src = items[wrap(current - 1)].full;
      new Image().src = items[wrap(current + 1)].full;
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft") {
        show(current - 1);
      } else if (event.key === "ArrowRight") {
        show(current + 1);
      } else if (event.key === "Tab") {
        // 열려 있는 동안 포커스를 라이트박스 버튼 안에서만 순환
        const buttons = [closeBtn, prevBtn, nextBtn].filter((button) => !button.hidden);
        const i = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      }
    }

    function open(list, index, trigger) {
      items = list;
      opener = trigger;
      prevBtn.hidden = nextBtn.hidden = list.length < 2;
      show(index);
      root.hidden = false;
      document.documentElement.classList.add("lightbox-open");
      document.addEventListener("keydown", onKeydown);
      closeBtn.focus();
    }

    function close() {
      root.hidden = true;
      img.removeAttribute("src");
      document.documentElement.classList.remove("lightbox-open");
      document.removeEventListener("keydown", onKeydown);
      opener?.focus();
    }

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => show(current - 1));
    nextBtn.addEventListener("click", () => show(current + 1));
    // 이미지·버튼 바깥(어두운 배경)을 누르면 닫기
    root.addEventListener("click", (event) => {
      if (event.target === root) close();
    });

    return { open };
  }

  /* ---------- 렌더링 ---------- */
  function renderHero(el, item) {
    const img = document.createElement("img");
    img.fetchPriority = "high";
    img.alt = "유리나무 대표 일러스트";
    img.src = item.full;
    el.replaceChildren(img);
  }

  function renderGrid(listEl, items, lightbox) {
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
      const link = document.createElement("a");
      link.className = "gallery-item";
      link.href = item.full; // JS 없이도 원본 이미지로 이동
      link.addEventListener("click", (event) => {
        // Ctrl/⌘·가운데 클릭(새 탭)은 브라우저 기본 동작 유지
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        lightbox.open(items, index, link);
      });

      const img = document.createElement("img");
      img.loading = "lazy"; // src보다 먼저 지정해야 지연 로딩이 적용됨
      img.decoding = "async";
      img.width = 600;
      img.height = 600;
      img.alt = altFor(index);
      img.src = item.thumb;

      const li = document.createElement("li");
      link.append(img);
      li.append(link);
      fragment.append(li);
    });

    listEl.replaceChildren(fragment);
  }

  function renderError(listEl) {
    const li = document.createElement("li");
    li.className = "gallery-status";
    li.textContent =
      location.protocol === "file:"
        ? "파일을 바로 열면 이미지 목록을 불러올 수 없어요. 로컬 서버(npm run preview)로 열어주세요."
        : "이미지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
    listEl.replaceChildren(li);
  }

  fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`${DATA_URL} 응답 ${res.status}`);
      return res.json();
    })
    .then((items) => {
      if (heroEl && items[0]) renderHero(heroEl, items[0]);
      if (gridEls.length === 0) return;

      const lightbox = createLightbox();
      for (const el of gridEls) {
        const limit = Number(el.dataset.limit) || items.length;
        renderGrid(el, items.slice(0, limit), lightbox);
      }
    })
    .catch((err) => {
      console.error(err);
      gridEls.forEach(renderError);
    });
})();
