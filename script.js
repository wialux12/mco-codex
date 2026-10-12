(() => {
  document.documentElement.classList.remove('no-js');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const header = $('#header');
  const burger = $('#burger');
  const nav = $('#nav');
  const toast = $('#toast');
  const toTop = $('#to-top');

  /* ---------- Шапка, кнопка «наверх» ---------- */
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    toTop.classList.toggle('is-visible', window.scrollY > 700);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- Мобильное меню ---------- */
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !burger.contains(e.target)) setMenu(false);
  });

  /* ---------- Подсветка активного пункта меню ---------- */
  const navLinks = $$('.nav a[href^="#"]:not(.btn)');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach((a) => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) spy.observe(target);
    });
  }

  /* ---------- Тост ---------- */
  let toastTimer;
  const showToast = (text) => {
    // открытая модалка лежит в top layer — переносим тост внутрь, иначе его не видно
    ($('dialog[open]') || document.body).appendChild(toast);
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  /* ---------- Копирование ---------- */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0';
      ($('dialog[open]') || document.body).appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  };
  const copyOrShow = async (text, okMessage) => {
    if (await copyText(text)) {
      showToast(okMessage);
      return;
    }
    const dlg = $('#copy-dialog');
    const area = $('#copy-area');
    area.value = text;
    dlg.showModal();
    area.focus();
    area.select();
  };
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tpl = document.getElementById(btn.dataset.copy);
      if (!tpl) return;
      copyOrShow(tpl.content.textContent.trim(),
        btn.dataset.copy === 'tpl-codex' ? 'Кодекс скопирован в буфер обмена' : 'Инструкции скопированы в буфер обмена');
    });
  });

  /* ---------- Модальные окна ---------- */
  $$('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = document.getElementById(btn.dataset.open);
      if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    });
  });
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  /* ---------- Кодекс: разметка из шаблона, оглавление, прогресс ---------- */
  const codexDialog = $('#codex-dialog');
  const codexBody = $('#codex-body');
  const codexToc = $('#codex-toc');
  const codexProgress = $('#codex-progress');
  const codexTpl = $('#tpl-codex');

  if (codexTpl && codexBody) {
    const lines = codexTpl.content.textContent.split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
    const el = (tag, text, key) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (key) node.dataset.key = key;
      return node;
    };
    const para = (lead, rest) => {
      const p = el('p', undefined, lead);
      if (lead) p.append(el('b', lead), ' ');
      p.append(rest);
      return p;
    };
    let list = null;
    lines.forEach((line) => {
      if (line.startsWith('•')) {
        if (!list) list = codexBody.appendChild(el('ul'));
        list.appendChild(el('li', line.replace(/^•\s*/, '')));
        return;
      }
      list = null;
      let m;
      if (line === 'ПРЕАМБУЛА' || line.startsWith('РАЗДЕЛ')) {
        codexBody.appendChild(el('h3', line, line));
      } else if ((m = line.match(/^(\d+\.\d+\.)\s*(.*)$/)) || (m = line.match(/^([А-ЯЁ][а-яё]+\.)\s(.*)$/))) {
        codexBody.appendChild(para(m[1], m[2]));
      } else {
        codexBody.appendChild(para('', line));
      }
    });

    // оглавление по разделам
    const heads = $$('h3', codexBody);
    const tocButtons = heads.map((h3) => {
      const m = h3.textContent.match(/^РАЗДЕЛ (\d+)\.\s*(.*)$/);
      const b = el('button', m ? `${m[1]}. ${m[2]}` : 'Преамбула');
      b.type = 'button';
      b.className = 'codex-toc__item';
      b.addEventListener('click', () => scrollCodexTo(h3));
      codexToc.appendChild(b);
      return b;
    });

    const updateCodexProgress = () => {
      const max = codexBody.scrollHeight - codexBody.clientHeight;
      codexProgress.style.transform = `scaleX(${max > 0 ? codexBody.scrollTop / max : 0})`;
      let active = 0;
      heads.forEach((h3, i) => { if (h3.offsetTop - 60 <= codexBody.scrollTop) active = i; });
      if (max > 0 && codexBody.scrollTop >= max - 2) active = heads.length - 1;
      tocButtons.forEach((b, i) => b.classList.toggle('is-active', i === active));
    };
    codexBody.addEventListener('scroll', updateCodexProgress, { passive: true });
    codexDialog.addEventListener('close', () => { codexBody.scrollTop = 0; });

    const scrollCodexTo = (node, flash) => {
      codexBody.scrollTo({ top: Math.max(0, node.offsetTop - 12), behavior: reduceMotion ? 'auto' : 'smooth' });
      if (flash) {
        node.classList.remove('is-flash');
        void node.offsetWidth;
        node.classList.add('is-flash');
      }
    };

    // открыть Кодекс (опционально — сразу на нужном пункте)
    const openCodex = (key) => {
      codexDialog.showModal();
      codexBody.scrollTop = 0;
      updateCodexProgress();
      if (!key) return;
      const node = $$('[data-key]', codexBody).find((n) => n.dataset.key.startsWith(key));
      if (node) requestAnimationFrame(() => scrollCodexTo(node, true));
    };
    window.mcoOpenCodex = openCodex;
    $$('[data-codex]').forEach((btn) => btn.addEventListener('click', () => openCodex(btn.dataset.codex)));
  }

  /* ---------- Ценности на орбите ---------- */
  const valueCard = $('#value-card');
  const pills = $$('.orbit .pill');
  const selectValue = (pill) => {
    pills.forEach((p) => p.setAttribute('aria-pressed', String(p === pill)));
    valueCard.replaceChildren();
    const title = document.createElement('h3');
    title.className = 'value-card__title';
    title.textContent = pill.textContent;
    const text = document.createElement('p');
    text.textContent = pill.dataset.text;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'link link--sm';
    more.innerHTML = 'Читать в Кодексе <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    more.addEventListener('click', () => window.mcoOpenCodex && window.mcoOpenCodex(pill.dataset.codexKey));
    valueCard.append(title, text, more);
    valueCard.classList.remove('is-in');
    void valueCard.offsetWidth;
    valueCard.classList.add('is-filled', 'is-in');
  };
  pills.forEach((pill) => pill.addEventListener('click', () => selectValue(pill)));

  /* ---------- Дорожная карта ---------- */
  const stepButtons = $$('.step__btn');
  const roadmapDetail = $('#roadmap-detail');
  stepButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      stepButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      $('[data-role="status"]', roadmapDetail).textContent = btn.dataset.status;
      $('[data-role="text"]', roadmapDetail).textContent = btn.dataset.text;
      roadmapDetail.classList.toggle('is-current', btn.closest('.step').classList.contains('step--current'));
      roadmapDetail.classList.remove('is-in');
      void roadmapDetail.offsetWidth;
      roadmapDetail.classList.add('is-in');
    });
    btn.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const next = stepButtons[(i + dir + stepButtons.length) % stepButtons.length];
      next.focus();
      next.click();
    });
  });
  roadmapDetail.classList.add('is-current');

  /* ---------- Стикеры: просмотр ---------- */
  const carousel = $('#sticker-carousel');
  const originals = carousel ? $$('.carousel__item', carousel) : [];
  const stickers = originals.map((item) => ({
    id: item.dataset.sticker,
    name: item.dataset.name,
    quote: item.dataset.quote,
    src: $('img', item).getAttribute('src'),
  }));

  const lb = $('#sticker-dialog');
  const lbImg = $('#lb-img');
  const lbName = $('#lb-name');
  const lbQuote = $('#lb-quote');
  const lbCount = $('#lb-count');
  const lbDownload = $('#lb-download');
  let lbIndex = 0;

  const showSticker = (index, dir = 0) => {
    lbIndex = (index + stickers.length) % stickers.length;
    const s = stickers[lbIndex];
    lbImg.src = s.src;
    lbImg.alt = `${s.name}: ${s.quote}`;
    lbName.textContent = s.name;
    lbQuote.textContent = s.quote;
    lbCount.textContent = `${lbIndex + 1} / ${stickers.length}`;
    lbDownload.href = s.src;
    lbDownload.download = `mco-sticker-${s.id}.webp`;
    lbImg.classList.remove('from-left', 'from-right');
    void lbImg.offsetWidth;
    if (dir) lbImg.classList.add(dir > 0 ? 'from-right' : 'from-left');
    // подгружаем соседей
    [1, -1].forEach((d) => { new Image().src = stickers[(lbIndex + d + stickers.length) % stickers.length].src; });
  };
  const openSticker = (id) => {
    const index = stickers.findIndex((s) => s.id === id);
    if (index < 0) return;
    showSticker(index);
    lb.showModal();
  };

  $$('.lightbox__nav', lb).forEach((b) => b.addEventListener('click', () => showSticker(lbIndex + Number(b.dataset.step), Number(b.dataset.step))));
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') showSticker(lbIndex + 1, 1);
    if (e.key === 'ArrowLeft') showSticker(lbIndex - 1, -1);
  });
  // свайп в просмотрщике
  const lbFigure = $('#lb-figure');
  let swipeX = null;
  lbFigure.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  lbFigure.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 45) showSticker(lbIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  lbFigure.addEventListener('pointercancel', () => { swipeX = null; });

  $('#lb-share').addEventListener('click', async () => {
    const s = stickers[lbIndex];
    const url = location.href.split('#')[0];
    const text = `${s.name}: ${s.quote}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Стикерпак «Великие о цифре»', text, url });
      } catch { /* пользователь закрыл окно «Поделиться» */ }
      return;
    }
    copyOrShow(`${text}\n${url}`, 'Ссылка скопирована — отправьте её друзьям');
  });

  // стикеры на странице тоже открываются в просмотрщике
  $$('img[data-sticker]').forEach((img) => {
    img.addEventListener('click', () => openSticker(img.dataset.sticker));
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSticker(img.dataset.sticker); }
    });
  });

  /* ---------- Стикеры: бесконечная карусель ---------- */
  if (carousel) {
    const vp = $('.carousel__viewport', carousel);
    const track = $('.carousel__track', carousel);
    const playBtn = $('.carousel__play', carousel);

    // по копии набора слева и справа — так можно листать бесконечно
    const clone = (item) => {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.tabIndex = -1;
      return c;
    };
    originals.slice().reverse().forEach((item) => track.prepend(clone(item)));
    originals.forEach((item) => track.append(clone(item)));

    let setW = 0;
    const measure = () => {
      const prev = setW;
      setW = originals[0].offsetLeft - track.children[0].offsetLeft;
      if (!prev) vp.scrollLeft = setW - 8;
      else if (prev !== setW) vp.scrollLeft = vp.scrollLeft * (setW / prev);
    };
    const normalize = () => {
      if (!setW) return 0;
      const x = vp.scrollLeft;
      let shift = 0;
      if (x < setW * 0.5) shift = setW;
      else if (x >= setW * 1.5) shift = -setW;
      if (shift) vp.scrollLeft = x + shift;
      return shift;
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    // автопрокрутка
    let autoplay = !reduceMotion;
    let hovering = false;
    let dragging = false;
    let inView = true;
    let holdUntil = 0;
    let last = performance.now();
    let acc = 0;
    let glide = 0;
    const hold = (ms = 3500) => { holdUntil = performance.now() + ms; };

    const setAutoplay = (on) => {
      autoplay = on;
      playBtn.setAttribute('aria-pressed', String(on));
      playBtn.setAttribute('aria-label', on ? 'Остановить автопрокрутку' : 'Включить автопрокрутку');
      playBtn.classList.toggle('is-paused', !on);
    };
    setAutoplay(autoplay);
    playBtn.addEventListener('click', () => setAutoplay(!autoplay));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(vp);
    }

    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (glide) {
        // инерция после перетаскивания мышью
        vp.scrollLeft -= glide * dt;
        normalize();
        glide *= Math.pow(0.93, dt / 16);
        if (Math.abs(glide) < 0.02) glide = 0;
      } else if (autoplay && inView && !hovering && !dragging && now > holdUntil && !document.hidden && !lb.open) {
        acc += 0.03 * dt;
        const step = Math.floor(acc);
        if (step) {
          acc -= step;
          vp.scrollLeft += step;
          normalize();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    vp.addEventListener('mouseenter', () => { hovering = true; });
    vp.addEventListener('mouseleave', () => { hovering = false; });
    ['wheel', 'touchstart', 'focusin'].forEach((ev) => vp.addEventListener(ev, () => hold(), { passive: true }));

    // после ручной прокрутки (свайп, колесо) возвращаемся в середину
    let scrollEnd;
    vp.addEventListener('scroll', () => {
      clearTimeout(scrollEnd);
      scrollEnd = setTimeout(() => { if (!dragging && !glide) normalize(); }, 140);
    }, { passive: true });

    // стрелки: ровно на один стикер
    const go = (dir) => {
      hold(5000);
      glide = 0;
      normalize();
      const pad = parseFloat(getComputedStyle(vp).paddingLeft) || 0;
      const x = vp.scrollLeft + pad;
      const items = [...track.children];
      const target = dir > 0
        ? items.find((it) => it.offsetLeft > x + 4)
        : items.slice().reverse().find((it) => it.offsetLeft < x - 4);
      if (target) vp.scrollTo({ left: target.offsetLeft - pad, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    $$('.carousel__btn', carousel).forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.dir))));
    vp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });

    // перетаскивание мышью с инерцией
    let startX = 0;
    let startLeft = 0;
    let moved = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    vp.addEventListener('pointerdown', (e) => {
      moved = 0;
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      glide = 0;
      startX = lastX = e.clientX;
      startLeft = vp.scrollLeft;
      lastT = performance.now();
      velocity = 0;
      hold();
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6 && !vp.classList.contains('is-dragging')) vp.classList.add('is-dragging');
      vp.scrollLeft = startLeft - dx;
      startLeft += normalize();
      const now = performance.now();
      if (now > lastT) velocity = (e.clientX - lastX) / (now - lastT);
      lastX = e.clientX;
      lastT = now;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      vp.classList.remove('is-dragging');
      if (moved > 6 && !reduceMotion && performance.now() - lastT < 80) glide = Math.max(-2, Math.min(2, velocity));
      hold();
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // клик по стикеру — открыть, но не после перетаскивания
    track.addEventListener('click', (e) => {
      const item = e.target.closest('.carousel__item');
      if (!item) return;
      if (moved > 6) { e.preventDefault(); return; }
      openSticker(item.dataset.sticker);
    });
  }

  /* ---------- Появление блоков ---------- */
  const items = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add('is-in'));
  }
})();
