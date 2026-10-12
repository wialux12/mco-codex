(() => {
  document.documentElement.classList.remove('no-js');
  const header = document.getElementById('header');
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  const toast = document.getElementById('toast');

  /* Шапка при скролле */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Мобильное меню */
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

  /* Тост */
  let toastTimer;
  const showToast = (text) => {
    // открытая модалка лежит в top layer — переносим тост внутрь, иначе его не видно
    (document.querySelector('dialog[open]') || document.body).appendChild(toast);
    toast.textContent = text;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  /* Копирование инструкций */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  };
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tpl = document.getElementById(btn.dataset.copy);
      if (!tpl) return;
      const text = tpl.content.textContent.trim();
      if (await copyText(text)) {
        showToast(btn.dataset.copy === 'tpl-codex' ? 'Кодекс скопирован в буфер обмена' : 'Инструкции скопированы в буфер обмена');
        return;
      }
      const dlg = document.getElementById('copy-dialog');
      const area = document.getElementById('copy-area');
      area.value = text;
      dlg.showModal();
      area.focus();
      area.select();
    });
  });

  /* Полный текст Кодекса: собираем разметку из шаблона tpl-codex */
  const codexTpl = document.getElementById('tpl-codex');
  const codexBody = document.getElementById('codex-body');
  if (codexTpl && codexBody) {
    const lines = codexTpl.content.textContent.split('\n').map((l) => l.trim()).filter(Boolean).slice(1);
    let list = null;
    const el = (tag, cls) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      return node;
    };
    const para = (lead, rest) => {
      const p = el('p');
      if (lead) {
        const b = el('b');
        b.textContent = lead;
        p.append(b, ' ');
      }
      p.append(rest);
      return p;
    };
    lines.forEach((line) => {
      if (line.startsWith('•')) {
        if (!list) list = codexBody.appendChild(el('ul'));
        const li = el('li');
        li.textContent = line.replace(/^•\s*/, '');
        list.appendChild(li);
        return;
      }
      list = null;
      let m;
      if (line === 'ПРЕАМБУЛА' || line.startsWith('РАЗДЕЛ')) {
        const h3 = el('h3');
        h3.textContent = line;
        codexBody.appendChild(h3);
      } else if ((m = line.match(/^(\d+\.\d+\.)\s*(.*)$/))) {
        codexBody.appendChild(para(m[1], m[2]));
      } else if ((m = line.match(/^([А-ЯЁ][а-яё]+\.)\s(.*)$/))) {
        codexBody.appendChild(para(m[1], m[2]));
      } else {
        codexBody.appendChild(para('', line));
      }
    });
  }

  /* Модальные окна */
  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = document.getElementById(btn.dataset.open);
      if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    });
  });
  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  /* Бесконечная лента стикеров: дублируем содержимое */
  const track = document.querySelector('.marquee__track');
  if (track) {
    [...track.children].forEach((img) => {
      const clone = img.cloneNode(true);
      clone.alt = '';
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  /* Появление блоков */
  const items = document.querySelectorAll('.reveal');
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
