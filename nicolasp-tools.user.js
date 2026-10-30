// ==UserScript==
// @name         NicolasP Tools [J A N]
// @namespace    NicolasPTools
// @version      4.6.2
// @description  Green Neon Edition for Bubble.am
// @author       NicolasP [J A N]
// @homepageURL  https://github.com/nick-poves/nicolasp-tools
// @supportURL   https://www.instagram.com/nick_poves/
// @updateURL    https://raw.githubusercontent.com/nick-poves/nicolasp-tools/main/nicolasp-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/nick-poves/nicolasp-tools/main/nicolasp-tools.user.js
// @match        https://bubble.am/*
// @match        https://buble.am/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const A = {
    version: '4.6.2',
    author: 'NicolasP [J A N]',
    instagram: 'https://www.instagram.com/nick_poves/'
  };

  const P = 'BT41_';
  const T = '__NICOLAS_LOCAL_SKIN_V41__';

  const read = (k, d) => {
    try { return localStorage.getItem(P + k) ?? d; }
    catch { return d; }
  };

  const write = (k, v) => {
    try { localStorage.setItem(P + k, String(v)); }
    catch {}
  };

  const clamp = (n, a, b, d) => {
    n = Number(n);
    return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d;
  };

  const S = {
    skin: read('skin', ''),
    forceSkin: read('forceSkin', 'false') === 'true',
    hideName: read('hideName', 'false') === 'true',
    fastFeed: read('fastFeed', 'false') === 'true',
    feedKey: read('feedKey', 'e').toLowerCase(),
    feedInterval: clamp(read('feedInterval', 30), 10, 150, 30),
    wasd: read('wasd', 'false') === 'true',
    distance: clamp(read('directionDistance', 10000), 1000, 30000, 10000),
    nick: '',
    feeding: false,
    feedTimer: null,
    moveTimer: null,
    launcher: false,
    menu: false,
    keys: { w: false, a: false, s: false, d: false }
  };

  if (S.feedKey.length !== 1 || 'wasd'.includes(S.feedKey)) {
    S.feedKey = 'e';
  }

  const N = {
    detect() {
      const inputs = [...document.querySelectorAll('input')].filter(e => {
        if (!['text', 'search'].includes(e.type)) return false;
        if (!e.getClientRects().length) return false;
        const info = [e.id, e.name, e.placeholder, e.getAttribute('aria-label')].join(' ');
        return /nick|username|player.?name|nombre/i.test(info) || e.disabled || e.readOnly;
      });

      const preferred = inputs.find(e =>
        /nick|username|player.?name|nombre/i.test(
          [e.id, e.name, e.placeholder].join(' ')
        )
      ) || inputs[0];

      const value = preferred?.value?.trim();

      if (value && value.length <= 48 && value !== S.nick) {
        S.nick = value;
        document.dispatchEvent(new Event('np:nick'));
      }
    },

    start() {
      this.detect();
      let pending = false;

      new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => {
          pending = false;
          this.detect();
        }, 150);
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value', 'readonly', 'disabled']
      });

      document.addEventListener('input', () => this.detect(), true);
      document.addEventListener('change', () => this.detect(), true);
      setInterval(() => this.detect(), 2000);
    }
  };

  const H = {
    clean(v) {
      return String(v ?? '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    },

    matches(v) {
      if (!S.hideName || !S.nick) return false;
      const nick = this.clean(S.nick);
      const text = this.clean(v);
      if (!nick || !text) return false;
      if (text === nick) return true;
      return text.replace(/^\[[^\]]+\]\s*/, '') === nick;
    },

    init() {
      for (const method of ['fillText', 'strokeText']) {
        const original = CanvasRenderingContext2D.prototype[method];
        if (typeof original !== 'function') continue;

        CanvasRenderingContext2D.prototype[method] = function (...args) {
          if (H.matches(args[0])) return;
          return original.apply(this, args);
        };
      }
    }
  };

  const K = {
    init() {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype, 'src'
      );

      if (descriptor?.get && descriptor?.set) {
        try {
          Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() { return descriptor.get.call(this); },
            set(value) {
              const next = S.skin && typeof value === 'string' && value.includes(T)
                ? S.skin : value;
              return descriptor.set.call(this, next);
            }
          });
        } catch {}
      }

      let original;

      try {
        Object.defineProperty(window, '_localSkin', {
          configurable: true,
          get() { return S.forceSkin && S.skin ? T : original; },
          set(v) { original = v; }
        });
      } catch {}

      setInterval(() => {
        if (S.forceSkin && S.skin) {
          try { window._localSkin = T; } catch {}
        }
      }, 250);
    }
  };

  const F = {
    event(type) {
      return new KeyboardEvent(type, {
        key: 'w',
        code: 'KeyW',
        keyCode: 87,
        which: 87,
        bubbles: true,
        cancelable: true
      });
    },

    once() {
      for (const type of ['keydown', 'keyup']) {
        window.dispatchEvent(this.event(type));
        document.dispatchEvent(this.event(type));
      }
    },

    start() {
      if (S.feeding || !S.fastFeed) return;
      S.feeding = true;
      this.once();
      S.feedTimer = setInterval(() => this.once(), S.feedInterval);
    },

    stop() {
      S.feeding = false;
      clearInterval(S.feedTimer);
      S.feedTimer = null;
    }
  };

  const M = {
    update() {
      if (!S.wasd) return;

      let x = Number(S.keys.d) - Number(S.keys.a);
      let y = Number(S.keys.s) - Number(S.keys.w);

      if (!x && !y) return;

      if (x && y) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }

      const clientX = innerWidth / 2 + x * S.distance;
      const clientY = innerHeight / 2 + y * S.distance;

      const options = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY
      };

      for (const target of [window, document, document.querySelector('canvas')]) {
        if (target) target.dispatchEvent(new MouseEvent('mousemove', options));
      }
    },

    start() {
      this.update();
      if (S.moveTimer === null) {
        S.moveTimer = setInterval(() => this.update(), 16);
      }
    },

    stop() {
      clearInterval(S.moveTimer);
      S.moveTimer = null;
    },

    reset() {
      for (const k of Object.keys(S.keys)) S.keys[k] = false;
      this.stop();
    }
  };

  const B = {
    init() {
      const editable = e =>
        e instanceof HTMLInputElement ||
        e instanceof HTMLTextAreaElement ||
        e?.isContentEditable;

      window.addEventListener('keydown', e => {
        if (!e.isTrusted || editable(e.target)) return;
        const key = e.key.toLowerCase();

        if (key === 'escape') {
          document.dispatchEvent(new Event('np:toggle'));
          return;
        }

        if (S.fastFeed && key === S.feedKey) {
          e.preventDefault();
          e.stopPropagation();
          F.start();
          return;
        }

        if (S.wasd && Object.hasOwn(S.keys, key)) {
          e.preventDefault();
          e.stopPropagation();
          S.keys[key] = true;
          M.start();
        }
      }, true);

      window.addEventListener('keyup', e => {
        if (!e.isTrusted) return;
        const key = e.key.toLowerCase();

        if (key === S.feedKey) {
          if (S.fastFeed || S.feeding) {
            e.preventDefault();
            e.stopPropagation();
          }
          F.stop();
          return;
        }

        if (Object.hasOwn(S.keys, key)) {
          S.keys[key] = false;
          if (S.wasd) {
            e.preventDefault();
            e.stopPropagation();
            M.update();
          }
          if (!Object.values(S.keys).some(Boolean)) M.stop();
        }
      }, true);

      window.addEventListener('blur', () => {
        F.stop();
        M.reset();
      });
    }
  };

  const U = {
    root: null,
    shadow: null,

    mount() {
      if (document.getElementById('nicolasp-tools')) return;

      this.root = document.createElement('div');
      this.root.id = 'nicolasp-tools';
      document.body.appendChild(this.root);
      this.shadow = this.root.attachShadow({ mode: 'open' });

      const ig = `<svg width="22" height="22" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/>
      </svg>`;

      this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: Inter, system-ui, Arial, sans-serif;
          color: #f2fff3;
          --green: #39ff14;
          --bg: #080b09;
          --surface: #101713;
          --border: #275c39;
        }

        * { box-sizing: border-box; }
        button, input { font: inherit; }
        button { cursor: pointer; }

        .launcher {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 2147483647;
          display: none;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: #101a13;
          color: var(--green);
          border: 1px solid var(--green);
          border-radius: 14px;
          box-shadow: 0 0 20px #39ff1460;
          font-size: 23px;
          transition: box-shadow .2s;
        }

        .launcher:hover {
          box-shadow: 0 0 28px #39ff1490;
        }

        .panel {
          position: fixed;
          top: 76px;
          right: 16px;
          z-index: 2147483647;
          display: none;
          flex-direction: column;
          width: 356px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 94px);
          overflow: hidden;
          background: var(--bg);
          color: #f2fff3;
          border: 1px solid var(--green);
          border-radius: 18px;
          box-shadow: 0 0 30px #39ff1430, 0 24px 70px #000c;
          font-size: 13px;
        }

        .panel.open { display: flex; }

        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 18px;
          background: linear-gradient(110deg, #172b1b, #080b09);
          border-bottom: 1px solid var(--border);
        }

        .identity {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .logo {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          background: linear-gradient(135deg, #39ff14, #0b842f);
          color: #071006;
          border: 1px solid #9dff85;
          border-radius: 12px;
          font-size: 23px;
          font-weight: 900;
          box-shadow: 0 0 20px #39ff1460;
        }

        .brand {
          font-size: 15px;
          font-weight: 850;
          color: white;
          white-space: nowrap;
        }

        .tag { color: var(--green); }

        .subtitle {
          margin-top: 4px;
          color: var(--green);
          font-size: 9px;
          letter-spacing: 1px;
        }

        .headRight {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .version {
          color: var(--green);
          font-size: 10px;
          font-weight: 800;
        }

        .close {
          padding: 5px;
          border: 0;
          background: transparent;
          color: #c6e6cb;
          font-size: 22px;
        }

        .scroll {
          padding: 14px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #327e3d transparent;
        }

        .status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 13px;
          margin-bottom: 13px;
          background: #101a13;
          border: 1px solid #2b6a37;
          border-left: 3px solid var(--green);
          border-radius: 11px;
        }

        .overline {
          color: #8ba893;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 1px;
        }

        .nick {
          margin-top: 5px;
          color: white;
          font-size: 15px;
          font-weight: 800;
        }

        .pill {
          color: var(--green);
          background: #39ff1415;
          border: 1px solid #39ff1455;
          border-radius: 20px;
          padding: 6px 9px;
          font-size: 10px;
          white-space: nowrap;
        }

        .section {
          padding: 14px;
          margin-bottom: 12px;
          background: linear-gradient(145deg, #121c14, #0b110d);
          border: 1px solid #2a5233;
          border-radius: 12px;
          transition: border-color .2s;
        }

        .section:hover { border-color: #39ff1480; }

        .sectionTitle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 12px;
          margin-bottom: 4px;
          border-bottom: 1px solid var(--border);
          color: #f1fff3;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: .8px;
        }

        .sectionTitle span {
          color: var(--green);
          font-size: 17px;
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 0;
          color: #d9eddd;
          font-size: 12px;
        }

        .hint {
          margin-top: 4px;
          color: #8ca994;
          font-size: 10px;
        }

        .switch {
          position: relative;
          width: 38px;
          height: 22px;
          flex-shrink: 0;
        }

        .switch input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }

        .track {
          display: block;
          width: 38px;
          height: 22px;
          background: #304333;
          border-radius: 20px;
          pointer-events: none;
        }

        .track::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: transform .2s;
        }

        .switch input:checked + .track {
          background: var(--green);
          box-shadow: 0 0 12px #39ff1460;
        }

        .switch input:checked + .track::after {
          background: #071006;
          transform: translateX(16px);
        }

        .action {
          width: 100%;
          margin: 6px 0;
          padding: 11px;
          background: linear-gradient(110deg, #39ff14, #20c94a);
          border: 1px solid #9dff85;
          border-radius: 9px;
          color: #071006;
          font-size: 12px;
          font-weight: 850;
          box-shadow: 0 0 13px #39ff1430;
        }

        .action:hover { box-shadow: 0 0 22px #39ff1470; }

        .action.secondary {
          background: #17271b;
          border-color: #356440;
          color: #c5e0ca;
          box-shadow: none;
        }

        .value {
          color: var(--green);
          font-size: 11px;
          font-weight: 800;
        }

        .range {
          width: 100%;
          margin: 8px 0;
          accent-color: var(--green);
        }

        .keyInput {
          width: 56px;
          padding: 8px;
          background: #0c170e;
          color: var(--green);
          border: 1px solid #39ff1475;
          border-radius: 8px;
          text-align: center;
          outline: none;
        }

        .keys {
          display: grid;
          grid-template-columns: repeat(3, 38px);
          grid-template-rows: repeat(2, 34px);
          justify-content: center;
          gap: 7px;
          margin: 12px 0;
        }

        .key {
          display: grid;
          place-items: center;
          background: #17271b;
          color: var(--green);
          border: 1px solid #368f49;
          border-bottom: 3px solid var(--green);
          border-radius: 7px;
          font-weight: 850;
        }

        .w { grid-column: 2; }
        .a { grid-column: 1; }
        .s { grid-column: 2; }
        .d { grid-column: 3; }

        .footer {
          padding: 15px;
          background: #090f0a;
          border-top: 1px solid #2b6b37;
        }

        .author {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #112015;
          border: 1px solid #327f3e;
          border-radius: 11px;
        }

        .authorName {
          margin-top: 5px;
          color: white;
          font-size: 15px;
          font-weight: 850;
        }

        .instagram {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          background: var(--green);
          color: #071006;
          border-radius: 11px;
          box-shadow: 0 0 16px #39ff1450;
          text-decoration: none;
        }

        .copyright {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          color: #829e88;
          font-size: 10px;
        }
      </style>

      <button id="launcher" class="launcher" title="NicolasP Tools">⚙</button>

      <section id="panel" class="panel">
        <header class="head">
          <div class="identity">
            <div class="logo">N</div>
            <div>
              <div class="brand">NicolasP <span class="tag">[J A N]</span></div>
              <div class="subtitle">BUBBLE.AM CONTROL CENTER</div>
            </div>
          </div>
          <div class="headRight">
            <span class="version">v${A.version}</span>
            <button id="close" class="close">×</button>
          </div>
        </header>

        <div class="scroll">
          <div class="status">
            <div>
              <div class="overline">JUGADOR CONECTADO</div>
              <div id="nick" class="nick">Detectando...</div>
            </div>
            <span id="nickStatus" class="pill">Pendiente</span>
          </div>

          <section class="section">
            <div class="sectionTitle"><span>◉</span> APARIENCIA</div>
            <div class="row">
              <div>
                Skin personalizada
                <div id="skinStatus" class="hint">${S.skin ? 'Imagen cargada' : 'Sin imagen'}</div>
              </div>
            </div>
            <input type="file" id="skinFile" accept="image/*" hidden>
            <button id="chooseSkin" class="action">SELECCIONAR SKIN</button>
            <div class="row">
              Forzar skin
              <label class="switch">
                <input id="forceSkin" type="checkbox" ${S.forceSkin ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>
            <div class="row">
              Ocultar nick en célula
              <label class="switch">
                <input id="hideName" type="checkbox" ${S.hideName ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>
            <button id="removeSkin" class="action secondary">ELIMINAR SKIN</button>
          </section>

          <section class="section">
            <div class="sectionTitle"><span>ϟ</span> FAST FEED</div>
            <div class="row">
              Activado
              <label class="switch">
                <input id="fastFeed" type="checkbox" ${S.fastFeed ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>
            <div class="row">
              Tecla de activación
              <input id="feedKey" class="keyInput" maxlength="1">
            </div>
            <div class="row">
              Intervalo
              <span id="feedValue" class="value">${S.feedInterval} ms</span>
            </div>
            <input id="feedSpeed" class="range" type="range"
              min="10" max="150" step="5" value="${S.feedInterval}">
          </section>

          <section class="section">
            <div class="sectionTitle"><span>✥</span> MOVIMIENTO WASD</div>
            <div class="row">
              Controles WASD
              <label class="switch">
                <input id="wasd" type="checkbox" ${S.wasd ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>
            <div class="keys">
              <div class="key w">W</div>
              <div class="key a">A</div>
              <div class="key s">S</div>
              <div class="key d">D</div>
            </div>
            <div class="row">
              Fuerza de dirección
              <span id="directionValue" class="value">${S.distance.toLocaleString()}</span>
            </div>
            <input id="direction" class="range" type="range"
              min="1000" max="30000" step="1000" value="${S.distance}">
          </section>
        </div>

        <footer class="footer">
          <div class="author">
            <div>
              <div class="overline">DEVELOPED BY</div>
              <div class="authorName">NicolasP <span class="tag">[J A N]</span></div>
            </div>
            <a class="instagram" href="${A.instagram}" target="_blank"
              rel="noopener noreferrer" title="Instagram @nick_poves">
              ${ig}
            </a>
          </div>
          <div class="copyright">
            <span>© 2026 NicolasP</span>
            <span>ESC · Mostrar / ocultar</span>
          </div>
        </footer>
      </section>`;

      this.bind();
    },

    $(id) {
      return this.shadow.getElementById(id);
    },

    bind() {
      const $ = id => this.$(id);

      const showLauncher = visible => {
        S.launcher = visible;
        $('launcher').style.display = visible ? 'flex' : 'none';
        if (!visible) {
          S.menu = false;
          $('panel').classList.remove('open');
        }
      };

      const showPanel = visible => {
        S.menu = visible;
        $('panel').classList.toggle('open', visible);
      };

      const refreshNick = () => {
        $('nick').textContent = S.nick || 'No detectado';
        $('nickStatus').textContent = S.nick ? 'Detectado' : 'Pendiente';
      };

      document.addEventListener('np:nick', refreshNick);
      document.addEventListener('np:toggle', () => showLauncher(!S.launcher));

      $('launcher').addEventListener('click', () => showPanel(!S.menu));
      $('close').addEventListener('click', () => showPanel(false));

      const toggle = (id, key, callback) => {
        $(id).addEventListener('change', e => {
          S[key] = e.target.checked;
          write(key, S[key]);
          callback?.();
        });
      };

      toggle('forceSkin', 'forceSkin');
      toggle('hideName', 'hideName');
      toggle('fastFeed', 'fastFeed', () => {
        if (!S.fastFeed) F.stop();
      });
      toggle('wasd', 'wasd', () => {
        if (!S.wasd) M.reset();
      });

      $('chooseSkin').addEventListener('click', () => $('skinFile').click());

      $('skinFile').addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result !== 'string') return;

          try {
            localStorage.setItem(P + 'skin', reader.result);
          } catch {
            alert('La imagen es demasiado grande.');
            return;
          }

          S.skin = reader.result;
          S.forceSkin = true;
          write('forceSkin', true);
          $('forceSkin').checked = true;
          $('skinStatus').textContent = 'Imagen cargada';

          try { window._localSkin = T; } catch {}
        };

        reader.readAsDataURL(file);
      });

      $('removeSkin').addEventListener('click', () => {
        S.skin = '';
        S.forceSkin = false;

        try { localStorage.removeItem(P + 'skin'); } catch {}
        write('forceSkin', false);

        $('forceSkin').checked = false;
        $('skinFile').value = '';
        $('skinStatus').textContent = 'Sin imagen';
      });

      $('feedKey').value = S.feedKey.toUpperCase();

      $('feedKey').addEventListener('change', e => {
        const key = e.target.value.trim().toLowerCase();

        if (key.length !== 1 || 'wasd'.includes(key)) {
          e.target.value = S.feedKey.toUpperCase();
          return;
        }

        F.stop();
        S.feedKey = key;
        write('feedKey', key);
        e.target.value = key.toUpperCase();
      });

      $('feedSpeed').addEventListener('input', e => {
        S.feedInterval = clamp(e.target.value, 10, 150, 30);
        write('feedInterval', S.feedInterval);
        $('feedValue').textContent = S.feedInterval + ' ms';

        if (S.feeding) {
          F.stop();
          F.start();
        }
      });

      $('direction').addEventListener('input', e => {
        S.distance = clamp(e.target.value, 1000, 30000, 10000);
        write('directionDistance', S.distance);
        $('directionValue').textContent = S.distance.toLocaleString();
      });

      refreshNick();
    }
  };

  K.init();
  H.init();
  B.init();

  const boot = () => {
    N.start();
    U.mount();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
