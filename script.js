(() => {
  document.documentElement.classList.remove('no-js');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Плавность: своя кривая и анимация прокрутки ---------- */
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // анимирует числовое значение; возвращает функцию отмены
  const tween = (from, to, duration, apply, done) => {
    if (reduceMotion || Math.abs(to - from) < 1) { apply(to); if (done) done(); return () => {}; }
    const t0 = performance.now();
    let raf = 0;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      apply(from + (to - from) * easeInOut(p));
      if (p < 1) raf = requestAnimationFrame(step);
      else if (done) done();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  };
  // длительность зависит от расстояния: близко — быстро, далеко — не дольше 1.2 с
  const scrollDuration = (dist) => Math.min(1200, Math.max(420, 280 + Math.abs(dist) * 0.32));
  let cancelPageScroll = () => {};
  const smoothScrollTo = (y, done) => {
    cancelPageScroll();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const target = Math.max(0, Math.min(max, y));
    const from = window.scrollY;
    cancelPageScroll = tween(from, target, scrollDuration(target - from), (v) => window.scrollTo({ top: v, behavior: 'instant' }), done);
  };
  // пользователь сам крутит страницу — не мешаем ему
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, () => cancelPageScroll(), { passive: true }));
  const smoothScrollEl = (el, prop, to) => {
    if (el._cancelTween) el._cancelTween();
    const from = el[prop];
    el._cancelTween = tween(from, to, Math.min(700, Math.max(320, Math.abs(to - from) * 0.6)), (v) => { el[prop] = v; });
  };

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
  toTop.addEventListener('click', () => smoothScrollTo(0));

  /* ---------- Якорные ссылки: плавная прокрутка с поправкой на шапку ---------- */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const offset = header.offsetHeight + 14;
    // блок может быть ещё сдвинут анимацией появления — считаем его итоговое место
    const shift = new DOMMatrixReadOnly(getComputedStyle(target).transform === 'none' ? undefined : getComputedStyle(target).transform).m42 || 0;
    const y = id === 'top' ? 0 : target.getBoundingClientRect().top - shift + window.scrollY - offset;
    history.pushState(null, '', `#${id}`);
    smoothScrollTo(y, () => {
      if (id === 'top') return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.classList.remove('is-arrived');
      void target.offsetWidth;
      target.classList.add('is-arrived');
    });
  });

  /* ---------- Внешние ссылки из #site-links (пустая ссылка — кнопка скрыта) ---------- */
  const siteLinks = (() => {
    try { return JSON.parse($('#site-links').textContent); } catch { return {}; }
  })();
  $$('[data-link]').forEach((a) => {
    const url = (siteLinks[a.dataset.link] || '').trim();
    if (url) a.href = url;
    else (a.closest('li') || a).hidden = true;
  });
  const socials = $('.socials');
  if (socials && !$$('li:not([hidden])', socials).length) socials.hidden = true;

  /* ---------- Затухание по краям у горизонтальных лент ---------- */
  const edgeFade = (el) => {
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.classList.toggle('fade-start', el.scrollLeft > 4);
      el.classList.toggle('fade-end', max > 4 && el.scrollLeft < max - 4);
    };
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    requestAnimationFrame(update);
    return update;
  };
  window.mcoEdgeFade = edgeFade;

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
  /* ---------- Правила «человек / ИИ»: тексты для копирования ---------- */
  const aiRules = (() => {
    try { return JSON.parse($('#ai-rules').textContent); } catch { return []; }
  })();
  const makeTemplate = (id, text) => {
    const tpl = document.createElement('template');
    tpl.id = id;
    tpl.content.textContent = text;
    document.body.appendChild(tpl);
  };
  const humanRulesText = [
    'Правила для человека: как безопасно работать с ИИ',
    'Кодекс этики цифровой среды — Молодёжный цифровой омбудсмен',
    '',
    ...aiRules.map((r, i) => `${i + 1}. ${r.topic}. ${r.human}`),
  ].join('\n');
  const aiPromptText = [
    'Соблюдай в этом диалоге правила «Кодекса этики поведения детей и подростков в цифровой среде» (Молодёжный цифровой омбудсмен):',
    '',
    ...aiRules.map((r, i) => `${i + 1}. ${r.topic}. ${r.ai}`),
  ].join('\n');
  makeTemplate('tpl-human-rules', humanRulesText);
  makeTemplate('tpl-ai-prompt', aiPromptText);

  /* ---------- Кнопки: копирование, модалки, Кодекс (делегирование) ---------- */
  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      const tpl = document.getElementById(copyBtn.dataset.copy);
      if (!tpl) return;
      const fallback = copyBtn.dataset.copy === 'tpl-codex' ? 'Кодекс скопирован в буфер обмена' : 'Скопировано в буфер обмена';
      copyOrShow(tpl.content.textContent.trim(), copyBtn.dataset.copied || fallback);
      copyBtn.classList.add('is-copied');
      setTimeout(() => copyBtn.classList.remove('is-copied'), 1600);
      return;
    }
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) {
      const dlg = document.getElementById(openBtn.dataset.open);
      if (dlg && typeof dlg.showModal === 'function') {
        dlg.showModal();
        const scroller = $('.rule-list, .prompt-box', dlg);
        if (scroller) scroller.scrollTop = 0;
      }
      return;
    }
    const codexBtn = e.target.closest('[data-codex]');
    if (codexBtn && window.mcoOpenCodex) {
      const current = codexBtn.closest('dialog[open]');
      if (current) current.close();
      window.mcoOpenCodex(codexBtn.dataset.codex);
    }
  });

  /* ---------- Модальные окна ---------- */
  const closeDialog = (dlg) => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    if (reduceMotion) { dlg.close(); return; }
    dlg.classList.add('is-closing');
    setTimeout(() => { dlg.classList.remove('is-closing'); dlg.close(); }, 200);
  };
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(dlg);
    });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(dlg); });
  });

  /* ---------- Правила для человека и промпт: наполнение модалок ---------- */
  const rulesList = $('#rules-list');
  aiRules.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'rule-list__item';
    const topic = document.createElement('span');
    topic.className = 'rule-list__topic';
    topic.textContent = r.topic;
    const text = document.createElement('p');
    text.textContent = r.human;
    li.append(topic, text);
    rulesList.appendChild(li);
  });
  $('#prompt-text').textContent = aiPromptText;

  /* ---------- Темы «человек / ИИ» ---------- */
  const riskTabs = $('#risks-tabs');
  const riskPanel = $('#risks-panel');
  const riskCount = $('#risks-count');
  let riskIndex = 0;
  const riskFade = edgeFade(riskTabs);
  const riskButtons = aiRules.map((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'risks__tab';
    b.setAttribute('role', 'tab');
    b.id = `risk-tab-${i}`;
    b.textContent = r.topic;
    b.addEventListener('click', () => showRisk(i));
    b.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      showRisk(riskIndex + dir, true);
    });
    riskTabs.appendChild(b);
    return b;
  });
  const showRisk = (i, focus) => {
    if (!aiRules.length) return;
    riskIndex = (i + aiRules.length) % aiRules.length;
    const r = aiRules[riskIndex];
    riskButtons.forEach((b, j) => {
      const on = j === riskIndex;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    const active = riskButtons[riskIndex];
    riskPanel.setAttribute('aria-labelledby', active.id);
    // прокручиваем ленту тем только по горизонтали, чтобы страница не прыгала
    const tabsMax = riskTabs.scrollWidth - riskTabs.clientWidth;
    if (tabsMax > 0) smoothScrollEl(riskTabs, 'scrollLeft', Math.max(0, Math.min(tabsMax, active.offsetLeft - riskTabs.clientWidth / 2 + active.offsetWidth / 2)));
    if (focus) active.focus({ preventScroll: true });
    riskStacks.forEach((list) => list.forEach((p, j) => p.classList.toggle('is-active', j === riskIndex)));
    riskCount.textContent = `${riskIndex + 1} / ${aiRules.length}`;
    riskPanel.classList.remove('is-in');
    void riskPanel.offsetWidth;
    riskPanel.classList.add('is-in');
  };
  const riskStacks = ['about', 'human', 'ai'].map((role) => {
    const stack = $(`[data-role="${role}"]`, riskPanel);
    return aiRules.map((r) => {
      const p = document.createElement('p');
      if (role === 'about') {
        // «Тема — описание»: название выделено, описание из данных
        const b = document.createElement('b');
        b.textContent = r.topic;
        p.append(b, ` — ${r.about || ''}`);
      } else {
        p.textContent = r[role];
      }
      stack.appendChild(p);
      return p;
    });
  });
  $$('[data-risk-step]').forEach((b) => b.addEventListener('click', () => showRisk(riskIndex + Number(b.dataset.riskStep))));
  showRisk(0);
  // свайп по карточкам на телефоне
  let riskX = null;
  riskPanel.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') riskX = e.clientX; });
  riskPanel.addEventListener('pointerup', (e) => {
    if (riskX === null) return;
    const dx = e.clientX - riskX;
    riskX = null;
    if (Math.abs(dx) > 50) showRisk(riskIndex + (dx < 0 ? 1 : -1));
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
    const tocFade = edgeFade(codexToc);
    codexDialog.addEventListener('toggle', () => tocFade && tocFade());
    codexDialog.addEventListener('close', () => { codexBody.scrollTop = 0; });

    const scrollCodexTo = (node, flash) => {
      smoothScrollEl(codexBody, 'scrollTop', Math.min(codexBody.scrollHeight - codexBody.clientHeight, Math.max(0, node.offsetTop - 12)));
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
      if (tocFade) tocFade();
      if (!key) return;
      const node = $$('[data-key]', codexBody).find((n) => n.dataset.key.startsWith(key));
      if (node) requestAnimationFrame(() => scrollCodexTo(node, true));
    };
    window.mcoOpenCodex = openCodex;
  }

  /* ---------- Ценности на орбите ---------- */
  // Все ценности лежат в одной ячейке грида, видна только активная —
  // высота карточки = самой длинной, поэтому блок не «прыгает».
  const whyCard = $('#about');
  const valueCard = $('#value-card');
  const valueTimer = $('.value-card__timer span', valueCard);
  const pills = $$('.orbit .pill');
  const valueItems = pills.map((pill) => {
    const item = document.createElement('div');
    item.className = 'value-card__item';
    const title = document.createElement('h3');
    title.className = 'value-card__title';
    title.textContent = pill.textContent;
    const text = document.createElement('p');
    text.textContent = pill.dataset.text;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'link link--sm';
    more.dataset.codex = pill.dataset.codexKey;
    more.innerHTML = 'Читать в Кодексе <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    item.append(title, text, more);
    valueCard.appendChild(item);
    return item;
  });
  const VALUE_MS = 5000;
  let valueIndex = 0;
  let valueLocked = false;      // пользователь выбрал ценность сам — не листаем
  let valueHover = false;
  let valueInView = false;
  let valueRunning = false;
  let valueStarted = 0;
  let valueElapsed = 0;
  let valueTimeout;
  let unlockTimer;
  const restartBar = () => {
    valueTimer.style.animation = 'none';
    void valueTimer.offsetWidth;
    valueTimer.style.animation = '';
  };
  const selectValue = (i) => {
    valueIndex = (i + pills.length) % pills.length;
    pills.forEach((p, j) => p.setAttribute('aria-pressed', String(j === valueIndex)));
    valueItems.forEach((it, j) => {
      it.classList.toggle('is-active', j === valueIndex);
      it.inert = j !== valueIndex;
    });
    clearTimeout(valueTimeout);
    valueRunning = false;
    valueElapsed = 0;
    restartBar();
    updateValueTimer();
  };
  // таймер на setTimeout, полоска — CSS-анимация; на паузе запоминаем, сколько прошло
  const updateValueTimer = () => {
    const shouldRun = !reduceMotion && !valueLocked && !valueHover && valueInView && !document.hidden && !$('dialog[open]');
    if (shouldRun && !valueRunning) {
      valueRunning = true;
      valueStarted = performance.now();
      valueTimeout = setTimeout(() => selectValue(valueIndex + 1), Math.max(0, VALUE_MS - valueElapsed));
    } else if (!shouldRun && valueRunning) {
      valueRunning = false;
      clearTimeout(valueTimeout);
      valueElapsed += performance.now() - valueStarted;
    }
    valueCard.classList.toggle('is-running', valueRunning);
  };
  const lockValues = () => {
    valueLocked = true;
    clearTimeout(unlockTimer);
    valueCard.classList.add('is-locked');
    updateValueTimer();
  };
  const unlockValues = (delay = 0) => {
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      if (!valueLocked) return;
      valueLocked = false;
      valueCard.classList.remove('is-locked');
      selectValue(valueIndex + 1);
    }, delay);
  };
  pills.forEach((pill, i) => pill.addEventListener('click', () => { selectValue(i); lockValues(); }));
  // фокус ушёл из блока, мышь ушла или блок пропал с экрана — снова листаем
  whyCard.addEventListener('focusout', (e) => { if (valueLocked && !whyCard.contains(e.relatedTarget)) unlockValues(4000); });
  whyCard.addEventListener('mouseenter', () => { valueHover = true; clearTimeout(unlockTimer); updateValueTimer(); });
  whyCard.addEventListener('mouseleave', () => { valueHover = false; if (valueLocked) unlockValues(6000); updateValueTimer(); });
  document.addEventListener('visibilitychange', updateValueTimer);
  $$('dialog').forEach((d) => d.addEventListener('close', updateValueTimer));
  document.addEventListener('click', () => setTimeout(updateValueTimer, 0));
  // ссылку на наблюдатель храним, иначе браузер может его собрать сборщиком мусора
  const valueObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    valueInView = entry.isIntersecting && entry.intersectionRatio >= 0.3;
    if (!valueInView && valueLocked) unlockValues();
    updateValueTimer();
  }, { threshold: [0, 0.3] }) : null;
  if (valueObserver) valueObserver.observe(whyCard);
  else valueInView = true;
  if (reduceMotion) valueCard.classList.add('is-locked');
  selectValue(0);

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
    lbDownload.href = `assets/stickers/mco-${s.id}.png`;
    lbDownload.download = `MCO-${s.id}.png`;
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

  /* ---------- Анимация скачивания: стикер улетает в правый верхний угол ---------- */
  const flyToCorner = (sources) => {
    const host = $('dialog[open]') || document.body;   // поверх открытой модалки
    const endX = window.innerWidth - 34;
    const endY = 26;
    // значок-приёмник в углу
    const target = document.createElement('span');
    target.className = 'fly-target';
    target.setAttribute('aria-hidden', 'true');
    target.innerHTML = '<svg><use href="#i-download"/></svg>';
    host.appendChild(target);
    let longest = 0;
    sources.forEach((src, i) => {
      const r = src.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const clone = src.cloneNode(false);
      clone.removeAttribute('id');
      clone.className = 'fly-sticker';
      clone.alt = '';
      clone.setAttribute('aria-hidden', 'true');
      Object.assign(clone.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      host.appendChild(clone);
      const dx = endX - (r.left + r.width / 2);
      const dy = endY - (r.top + r.height / 2);
      const delay = i * 110;
      longest = Math.max(longest, delay + 950);
      clone.animate([
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.25}px, ${dy * 0.2 - 40}px) scale(.82) rotate(-5deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px) scale(.05) rotate(-16deg)`, opacity: 0.3 },
      ], { duration: 950, delay, easing: 'cubic-bezier(.55, 0, .35, 1)', fill: 'both' }).onfinish = () => clone.remove();
    });
    target.animate([
      { transform: 'scale(.4)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: 0.2 },
      { transform: 'scale(1)', opacity: 1, offset: 0.75 },
      { transform: 'scale(1.25)', opacity: 1, offset: 0.85 },
      { transform: 'scale(.6)', opacity: 0 },
    ], { duration: longest + 700, easing: 'ease-out', fill: 'both' }).onfinish = () => target.remove();
  };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-fly]');
    if (!link) return;
    const isPack = /stickerpack\.zip$/.test(link.getAttribute('href') || '');
    showToast(isPack ? 'Стикерпак скачивается…' : 'Стикер скачивается…');
    if (reduceMotion) return;
    let sources = [];
    if (link.dataset.fly === 'current') {
      sources = [$('#lb-img')];
    } else {
      // стикеры, которые сейчас видны в карусели
      const vp = $('.carousel__viewport');
      const box = vp.getBoundingClientRect();
      sources = $$('.carousel__item img', vp).filter((img) => {
        const r = img.getBoundingClientRect();
        return r.right > box.left + 20 && r.left < box.right - 20;
      }).slice(0, 4);
    }
    flyToCorner(sources.filter(Boolean));
  });

  // браузер без поддержки download (часть встроенных браузеров) — откроем файл в новой вкладке,
  // оттуда картинку можно сохранить долгим нажатием
  if (!('download' in HTMLAnchorElement.prototype)) {
    $$('a[download]').forEach((a) => { a.removeAttribute('download'); a.target = '_blank'; });
  }

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
    let carouselObserver = null;
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
      carouselObserver = new IntersectionObserver((entries) => { inView = entries[entries.length - 1].isIntersecting; });
      carouselObserver.observe(vp);
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
      if (target) smoothScrollEl(vp, 'scrollLeft', target.offsetLeft - pad);
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
