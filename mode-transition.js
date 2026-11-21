/* =============================================
   MODE TRANSITION ENGINE (Gaple <-> Truf Remi)
   ============================================= */

(function () {
  const STORAGE_KEY = 'mode-transition';

  function isReducedMotion() {
    try {
      if (document.body && document.body.classList.contains('lite-mode')) return true;
      if (localStorage.getItem('lite-mode') === 'true') return true;
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function buildCurtainMarkup(mode) {
    if (mode === 'truf') {
      return `
        <div class="curtain-inner">
          <div class="curtain-svg-wrap curtain-truf-fan" aria-hidden="true">
            <svg width="116" height="90" viewBox="0 0 116 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(14 14) rotate(-14 22 32)">
                <rect x="0" y="0" width="44" height="62" rx="7" fill="#FAF6EE" stroke="#D4AF37" stroke-width="1.8"/>
                <text x="7" y="16" fill="#D92D20" font-family="Georgia,serif" font-size="11" font-weight="700">K</text>
                <text x="22" y="40" text-anchor="middle" fill="#D92D20" font-size="22">♥</text>
              </g>
              <g transform="translate(58 14) rotate(14 22 32)">
                <rect x="0" y="0" width="44" height="62" rx="7" fill="#FAF6EE" stroke="#D4AF37" stroke-width="1.8"/>
                <text x="7" y="16" fill="#D92D20" font-family="Georgia,serif" font-size="11" font-weight="700">Q</text>
                <text x="22" y="40" text-anchor="middle" fill="#D92D20" font-size="22">♦</text>
              </g>
              <g transform="translate(36 6)">
                <rect x="0" y="0" width="44" height="62" rx="7" fill="#FFFDF8" stroke="#F6D87B" stroke-width="2.2"/>
                <text x="7" y="16" fill="#151921" font-family="Georgia,serif" font-size="11" font-weight="700">A</text>
                <text x="22" y="40" text-anchor="middle" fill="#151921" font-size="23">♠</text>
              </g>
            </svg>
          </div>
          <div class="curtain-title curtain-title-truf">MEJA TRUF REMI</div>
          <div class="curtain-subtitle">Menyiapkan 52 Kartu...</div>
        </div>
      `;
    }

    return `
      <div class="curtain-inner">
        <div class="curtain-svg-wrap curtain-gaple-pop" aria-hidden="true">
          <svg width="96" height="84" viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(17, 6) rotate(-10 25 36)">
              <rect x="2" y="2" width="36" height="64" rx="7" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.6"/>
              <rect x="6" y="32.6" width="28" height="2.8" rx="1.2" fill="#DC2626"/>
              <circle cx="20" cy="18" r="3.4" fill="#DC2626"/>
              <circle cx="12" cy="44" r="2.9" fill="#0F172A"/>
              <circle cx="28" cy="56" r="2.9" fill="#0F172A"/>
            </g>
            <g transform="translate(47, 8) rotate(10 25 36)">
              <rect x="2" y="2" width="36" height="64" rx="7" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.6"/>
              <rect x="6" y="32.6" width="28" height="2.8" rx="1.2" fill="#DC2626"/>
              <circle cx="12" cy="11" r="2.9" fill="#DC2626"/>
              <circle cx="20" cy="18" r="2.9" fill="#DC2626"/>
              <circle cx="28" cy="25" r="2.9" fill="#DC2626"/>
            </g>
          </svg>
        </div>
        <div class="curtain-title curtain-title-gaple">PAPAN SKOR GAPLE</div>
        <div class="curtain-subtitle">Menyiapkan Meja Domino...</div>
      </div>
    `;
  }

  function ensureCurtain(mode) {
    let curtain = document.getElementById('mode-transition-curtain');
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'mode-transition-curtain';
      document.body.appendChild(curtain);
    }
    curtain.className = `mode-transition-curtain curtain-${mode}`;
    curtain.innerHTML = buildCurtainMarkup(mode);
    return curtain;
  }

  function clearLingeringCurtain() {
    window.__modeTransitioning = false;
    if (document.documentElement) {
      document.documentElement.classList.remove('mode-arriving');
    }
    const existing = document.getElementById('mode-transition-curtain');
    if (existing && !existing.classList.contains('curtain-exit') && !existing.classList.contains('curtain-holding')) {
      existing.remove();
    }
  }

  window.switchGameMode = function (event, targetMode, targetUrl) {
    if (event) {
      const link = event.currentTarget;
      if (link && (link.classList.contains('active') || link.classList.contains('active-truf'))) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
    }

    if (window.__modeTransitioning) return;
    window.__modeTransitioning = true;

    let originX = Math.round(window.innerWidth / 2);
    let originY = Math.round(window.innerHeight / 2);
    if (event) {
      if (typeof event.clientX === 'number' && event.clientX > 0) {
        originX = Math.round(event.clientX);
        originY = Math.round(event.clientY);
      } else if (event.currentTarget && event.currentTarget.getBoundingClientRect) {
        const rect = event.currentTarget.getBoundingClientRect();
        originX = Math.round(rect.left + rect.width / 2);
        originY = Math.round(rect.top + rect.height / 2);
      }
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, targetMode);
    } catch (_) {}

    const lite = isReducedMotion();
    const curtain = ensureCurtain(targetMode);
    curtain.style.setProperty('--origin-x', `${originX}px`);
    curtain.style.setProperty('--origin-y', `${originY}px`);

    void curtain.offsetWidth;
    curtain.classList.add(lite ? 'curtain-enter-lite' : 'curtain-enter');

    const delay = lite ? 190 : 480;
    window.setTimeout(() => {
      window.location.href = targetUrl;
    }, delay);
  };

  window.initModeTransitionArrival = function (currentMode) {
    let incoming = null;
    try {
      incoming = sessionStorage.getItem(STORAGE_KEY);
      if (incoming === currentMode) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}

    if (incoming !== currentMode) {
      clearLingeringCurtain();
      return;
    }

    const lite = isReducedMotion();
    const curtain = ensureCurtain(currentMode);
    curtain.classList.add('curtain-holding');

    const targetSelector = currentMode === 'truf' ? '.truf-shell' : '#page-home';
    const contentEl = document.querySelector(targetSelector);

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        if (document.documentElement) {
          document.documentElement.classList.remove('mode-arriving');
        }
        if (contentEl) {
          contentEl.classList.remove('mode-content-reveal');
          void contentEl.offsetWidth;
          contentEl.classList.add('mode-content-reveal');
        }
        curtain.classList.remove('curtain-holding');
        curtain.classList.add(lite ? 'curtain-exit-lite' : 'curtain-exit');

        window.setTimeout(() => {
          curtain.remove();
          window.__modeTransitioning = false;
        }, lite ? 200 : 480);
      }, lite ? 40 : 110);
    });
  };

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      window.__modeTransitioning = false;
      if (document.documentElement) {
        document.documentElement.classList.remove('mode-arriving');
      }
      const existing = document.getElementById('mode-transition-curtain');
      if (existing) existing.remove();
    }
  });
})();
