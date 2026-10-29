// ==UserScript==
// @name         NicolasP Tools [J A N]
// @namespace    https://www.instagram.com/nick_poves/
// @version      4.5.1
// @description  Personalización, movimiento y controles para Bubble.am
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

const APP = Object.freeze({
  name: 'NicolasP Tools',
  version: '4.5.1',
  author: 'NicolasP [J A N]',
  instagram: 'https://www.instagram.com/nick_poves/'
});

const KEYS = Object.freeze({
  skin: 'BT41_skin',
  forceSkin: 'BT41_forceSkin',
  hideName: 'BT41_hideName',
  fastFeed: 'BT41_fastFeed',
  feedKey: 'BT41_feedKey',
  feedInterval: 'BT41_feedInterval',
  wasd: 'BT41_wasd',
  directionDistance: 'BT41_directionDistance'
});

const TOKEN = '__NICOLAS_LOCAL_SKIN_V41__';

const read = (key, fallback) => {
  try {
    return localStorage.getItem(KEYS[key]) ?? fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => {
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {}
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.max(min, Math.min(max, n))
    : fallback;
};

const normalize = value =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const state = {
  skin: read('skin', ''),
  forceSkin: read('forceSkin', 'true') === 'true',
  hideName: read('hideName', 'true') === 'true',
  fastFeed: read('fastFeed', 'true') === 'true',
  feedKey: read('feedKey', 'e').toLowerCase(),
  feedInterval: clamp(read('feedInterval', 30), 10, 150, 30),
  wasd: read('wasd', 'true') === 'true',
  directionDistance: clamp(
    read('directionDistance', 10000),
    1000, 30000, 10000
  ),
  nick: '',
  feeding: false,
  feedTimer: null,
  moveTimer: null,
  directions: { w: false, a: false, s: false, d: false }
};

if (
  state.feedKey.length !== 1 ||
  'wasd'.includes(state.feedKey)
) {
  state.feedKey = 'e';
}

/* ACCOUNT DETECTION */

const NickDetector = {
  observer: null,

  detect() {
    const inputs = [...document.querySelectorAll('input')];

    const candidates = inputs.filter(el => {
      if (!['text', 'search'].includes(el.type)) return false;
      if (!el.getClientRects().length) return false;

      const metadata = [
        el.id,
        el.name,
        el.placeholder,
        el.getAttribute('aria-label')
      ].join(' ').toLowerCase();

      return (
        /nick|username|player.?name|nombre/.test(metadata) ||
        el.readOnly ||
        el.disabled
      );
    });

    const input = candidates.find(el => {
      const metadata = [
        el.id, el.name, el.placeholder
      ].join(' ');

      return /nick|username|player.?name|nombre/i.test(metadata);
    }) || candidates[0];

    const nick = input?.value?.trim();

    if (nick && nick.length <= 48 && nick !== state.nick) {
      state.nick = nick;

      document.dispatchEvent(
        new CustomEvent('np:nick-updated')
      );
    }
  },

  start() {
    this.detect();

    let pending = false;

    this.observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;

      setTimeout(() => {
        pending = false;
        this.detect();
      }, 150);
    });

    this.observer.observe(document.documentElement, {
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

/* SKIN ENGINE */

const SkinEngine = {
  init() {
    const descriptor =
      Object.getOwnPropertyDescriptor(
        HTMLImageElement.prototype, 'src'
      );

    if (descriptor?.get && descriptor?.set) {
      try {
        Object.defineProperty(
          HTMLImageElement.prototype,
          'src',
          {
            configurable: true,
            enumerable: descriptor.enumerable,

            get() {
              return descriptor.get.call(this);
            },

            set(value) {
              const result =
                state.skin &&
                typeof value === 'string' &&
                value.includes(TOKEN)
                  ? state.skin
                  : value;

              return descriptor.set.call(this, result);
            }
          }
        );
      } catch {}
    }

    let originalSkin;

    try {
      Object.defineProperty(window, '_localSkin', {
        configurable: true,

        get() {
          return state.forceSkin && state.skin
            ? TOKEN
            : originalSkin;
        },

        set(value) {
          originalSkin = value;
        }
      });
    } catch {}

    setInterval(() => {
      if (state.forceSkin && state.skin) {
        try {
          window._localSkin = TOKEN;
        } catch {}
      }
    }, 250);
  }
};

/* NAME ENGINE */

const NameEngine = {
  init() {
    const shouldHide = (ctx, text) => {
      if (!state.hideName || !state.nick) return false;

      if (normalize(text) !== normalize(state.nick)) {
        return false;
      }

      const match =
        String(ctx.font || '').match(/(\d+(?:\.\d+)?)px/i);

      return !!match && Number(match[1]) >= 35;
    };

    for (const method of ['fillText', 'strokeText']) {
      const original =
        CanvasRenderingContext2D.prototype[method];

      CanvasRenderingContext2D.prototype[method] =
        function (...args) {
          if (shouldHide(this, args[0])) return;
          return original.apply(this, args);
        };
    }
  }
};

/* FAST FEED */

const FeedEngine = {
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
    if (state.feeding || !state.fastFeed) return;

    state.feeding = true;
    this.once();

    state.feedTimer = setInterval(
      () => this.once(),
      state.feedInterval
    );
  },

  stop() {
    state.feeding = false;

    if (state.feedTimer !== null) {
      clearInterval(state.feedTimer);
      state.feedTimer = null;
    }
  }
};

/* MOVEMENT ENGINE */

const MovementEngine = {
  update() {
    if (!state.wasd) return;

    let x =
      Number(state.directions.d) -
      Number(state.directions.a);

    let y =
      Number(state.directions.s) -
      Number(state.directions.w);

    if (!x && !y) return;

    if (x && y) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }

    const targetX =
      window.innerWidth / 2 +
      x * state.directionDistance;

    const targetY =
      window.innerHeight / 2 +
      y * state.directionDistance;

    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: targetX,
      clientY: targetY,
      screenX: targetX,
      screenY: targetY
    };

    const targets = [
      window,
      document,
      document.querySelector('canvas')
    ];

    for (const target of targets) {
      if (target) {
        target.dispatchEvent(
          new MouseEvent('mousemove', options)
        );
      }
    }
  },

  start() {
    this.update();

    if (state.moveTimer === null) {
      state.moveTimer = setInterval(
        () => this.update(),
        16
      );
    }
  },

  stop() {
    if (state.moveTimer !== null) {
      clearInterval(state.moveTimer);
      state.moveTimer = null;
    }
  },

  reset() {
    for (const key of Object.keys(state.directions)) {
      state.directions[key] = false;
    }

    this.stop();
  }
};

/* KEYBOARD CONTROLLER */

const KeyboardController = {
  init() {
    window.addEventListener('keydown', event => {
      if (!event.isTrusted) return;

      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'escape') {
        setTimeout(() => {
          document.dispatchEvent(
            new CustomEvent('np:toggle')
          );
        }, 30);
        return;
      }

      if (state.fastFeed && key === state.feedKey) {
        event.preventDefault();
        event.stopPropagation();
        FeedEngine.start();
        return;
      }

      if (
        state.wasd &&
        Object.hasOwn(state.directions, key)
      ) {
        event.preventDefault();
        event.stopPropagation();

        state.directions[key] = true;
        MovementEngine.start();
      }
    }, true);

    window.addEventListener('keyup', event => {
      if (!event.isTrusted) return;

      const key = event.key.toLowerCase();

      if (key === state.feedKey) {
        event.preventDefault();
        event.stopPropagation();
        FeedEngine.stop();
        return;
      }

      if (Object.hasOwn(state.directions, key)) {
        state.directions[key] = false;

        if (state.wasd) {
          event.preventDefault();
          event.stopPropagation();
          MovementEngine.update();
        }

        if (!Object.values(state.directions).some(Boolean)) {
          MovementEngine.stop();
        }
      }
    }, true);

    window.addEventListener('blur', () => {
      FeedEngine.stop();
      MovementEngine.reset();
    });
  }
};

/* GAMING UI */

const UI = {
  root: null,
  shadow: null,
  visible: false,

  icon(name, size = 20) {
    const paths = {
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l-2.52 2.52A1.7 1.7 0 0 0 15 19.4L14 21h-4l-1-1.6a1.7 1.7 0 0 0-2.22.34l-2.52-2.52A1.7 1.7 0 0 0 4.6 15L3 14v-4l1.6-1a1.7 1.7 0 0 0-.34-2.22l2.52-2.52A1.7 1.7 0 0 0 9 4.6L10 3h4l1 1.6a1.7 1.7 0 0 0 2.22-.34l2.52 2.52A1.7 1.7 0 0 0 19.4 9L21 10v4Z"/>',
      instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/>',
      eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
      move: '<path d="M12 2v20M2 12h20m-14-6 4-4 4 4m-8 12 4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',
      close: '<path d="M18 6 6 18M6 6l12 12"/>'
    };

    return `<svg width="${size}" height="${size}"
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${paths[name]}</svg>`;
  },

  mount() {
    if (document.getElementById('nicolasp-tools')) return;

    this.root = document.createElement('div');
    this.root.id = 'nicolasp-tools';
    document.body.appendChild(this.root);

    this.shadow = this.root.attachShadow({ mode: 'open' });

    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: Inter, system-ui, Arial, sans-serif;
          color: #f2fff3;
          --neon: #39ff14;
          --dark: #080b09;
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
          color: var(--neon);
          background: #101a13;
          border: 1px solid var(--neon);
          border-radius: 14px;
          box-shadow: 0 0 18px #39ff1440, 0 12px 35px #000a;
        }

        .launcher:hover {
          box-shadow: 0 0 25px #39ff1480;
        }

        .panel {
          position: fixed;
          top: 76px;
          right: 16px;
          z-index: 2147483647;
          width: 356px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 94px);
          display: none;
          flex-direction: column;
          overflow: hidden;
          background: var(--dark);
          border: 1px solid #358b43;
          border-radius: 19px;
          box-shadow: 0 0 28px #39ff1420, 0 25px 75px #000c;
          color: #f2fff3;
          font-size: 13px;
        }

        .panel.open { display: flex; }

        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 19px;
          background: linear-gradient(125deg,#142b1b,#080b09);
          border-bottom: 1px solid var(--border);
        }

        .identity {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .logo {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          background: #39ff14;
          color: #071006;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 0 19px #39ff1460;
        }

        .brand {
          font-size: 16px;
          font-weight: 850;
          letter-spacing: -.5px;
        }

        .subtitle {
          color: var(--neon);
          font-size: 10px;
          margin-top: 3px;
          letter-spacing: .7px;
        }

        .headRight {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .version {
          color: var(--neon);
          background: #39ff1412;
          padding: 5px 7px;
          border-radius: 7px;
          font-size: 10px;
        }

        .close {
          display: grid;
          place-items: center;
          border: 0;
          background: transparent;
          color: #b6d1bd;
          padding: 5px;
        }

        .scroll {
          padding: 15px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #275c39 transparent;
        }

        .status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 13px;
          margin-bottom: 14px;
          background: #101a13;
          border: 1px solid #275c39;
          border-radius: 12px;
        }

        .overline {
          color: #8aa392;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .nick {
          margin-top: 5px;
          font-weight: 800;
          font-size: 14px;
        }

        .pill {
          padding: 6px 9px;
          background: #15381b;
          color: var(--neon);
          border-radius: 20px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .pill.wait {
          background: #3a301b;
          color: #e8c46a;
        }

        .section {
          padding: 15px;
          margin-bottom: 12px;
          border: 1px solid #275c39;
          border-radius: 14px;
          background: #101713;
        }

        .sectionHead {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 12px;
          margin-bottom: 5px;
          border-bottom: 1px solid #275c39;
        }

        .sectionIcon {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          background: #17351e;
          color: var(--neon);
          border-radius: 9px;
        }

        .sectionTitle {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .4px;
        }

        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
        }

        .label {
          font-size: 12px;
          color: #e2f1e5;
        }

        .hint {
          color: #8aa392;
          font-size: 10px;
          margin-top: 4px;
        }

        .switch {
          position: relative;
          width: 38px;
          height: 22px;
          flex-shrink: 0;
        }

        .switch input {
          position: absolute;
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
          border-radius: 20px;
          background: #36473a;
          pointer-events: none;
        }

        .track::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          transition: transform .2s;
        }

        .switch input:checked + .track {
          background: var(--neon);
        }

        .switch input:checked + .track::after {
          transform: translateX(16px);
          background: #071006;
        }

        .action {
          width: 100%;
          padding: 11px;
          margin: 6px 0;
          border: 1px solid var(--neon);
          border-radius: 10px;
          background: var(--neon);
          color: #071006;
          font-size: 12px;
          font-weight: 800;
          box-shadow: 0 0 14px #39ff142a;
        }

        .action.secondary {
          background: #17301d;
          border-color: #326b3b;
          color: #c9e7cf;
          box-shadow: none;
        }

        .action:hover { filter: brightness(1.12); }

        .value {
          color: var(--neon);
          font-size: 11px;
          font-weight: 750;
        }

        .range {
          width: 100%;
          accent-color: var(--neon);
          margin: 8px 0;
        }

        .keyInput {
          width: 58px;
          padding: 8px;
          border: 1px solid #326b3b;
          border-radius: 8px;
          outline: none;
          background: #17271b;
          color: var(--neon);
          text-align: center;
        }

        .keys {
          display: grid;
          grid-template-columns: repeat(3,39px);
          grid-template-rows: repeat(2,35px);
          justify-content: center;
          gap: 6px;
          margin: 12px 0;
        }

        .key {
          display: grid;
          place-items: center;
          background: #17271b;
          border: 1px solid #326b3b;
          border-radius: 8px;
          font-weight: 800;
          color: var(--neon);
        }

        .w { grid-column: 2; }
        .a { grid-column: 1; }
        .s { grid-column: 2; }
        .d { grid-column: 3; }

        .footer {
          padding: 16px 19px;
          background: #0c130e;
          border-top: 1px solid #275c39;
        }

        .author {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: #101a13;
          border: 1px solid #275c39;
          border-radius: 12px;
        }

        .authorName {
          font-size: 15px;
          font-weight: 800;
          margin-top: 4px;
        }

        .instagram {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 11px;
          color: #071006;
          background: var(--neon);
          box-shadow: 0 0 14px #39ff1440;
        }

        .instagram:hover { filter: brightness(1.15); }

        .copyright {
          display: flex;
          justify-content: space-between;
          margin-top: 13px;
          color: #789582;
          font-size: 10px;
        }
      </style>

      <button id="launcher" class="launcher">
        ${this.icon('settings', 23)}
      </button>

      <section id="panel" class="panel">
        <header class="head">
          <div class="identity">
            <div class="logo">N</div>
            <div>
              <div class="brand">NicolasP Tools [J A N]</div>
              <div class="subtitle">BUBBLE.AM CONTROL CENTER</div>
            </div>
          </div>
          <div class="headRight">
            <span class="version">v${APP.version}</span>
            <button class="close" id="close">
              ${this.icon('close', 17)}
            </button>
          </div>
        </header>

        <div class="scroll">
          <div class="status">
            <div>
              <div class="overline">Jugador conectado</div>
              <div class="nick" id="nick">Detectando...</div>
            </div>
            <span class="pill wait" id="nickStatus">Pendiente</span>
          </div>

          <div class="section">
            <div class="sectionHead">
              <span class="sectionIcon">${this.icon('eye')}</span>
              <span class="sectionTitle">APARIENCIA</span>
            </div>

            <div class="row">
              <div>
                <div class="label">Skin personalizada</div>
                <div class="hint" id="skinStatus">
                  ${state.skin ? 'Imagen cargada' : 'Sin imagen'}
                </div>
              </div>
            </div>

            <input id="skinFile" type="file" accept="image/*" hidden>
            <button id="chooseSkin" class="action">
              SELECCIONAR SKIN
            </button>

            <div class="row">
              <span class="label">Forzar skin</span>
              <label class="switch">
                <input id="forceSkin" type="checkbox"
                  ${state.forceSkin ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>

            <div class="row">
              <span class="label">Ocultar nick en celula</span>
              <label class="switch">
                <input id="hideName" type="checkbox"
                  ${state.hideName ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>

            <button id="removeSkin" class="action secondary">
              ELIMINAR SKIN
            </button>
          </div>

          <div class="section">
            <div class="sectionHead">
              <span class="sectionIcon">${this.icon('bolt')}</span>
              <span class="sectionTitle">FAST FEED</span>
            </div>

            <div class="row">
              <span class="label">Activado</span>
              <label class="switch">
                <input id="fastFeed" type="checkbox"
                  ${state.fastFeed ? 'checked' : ''}>
                <span class="track"></span>
              </label>
            </div>

            <div class="row">
              <span class="label">Tecla de activacion</span>
              <input id="feedKey" class="keyInput" maxlength="1">
            </div>

            <div class="row">
              <span class="label">Intervalo</span>
              <span class="value" id="feedValue">
                ${state.feedInterval} ms
              </span>
            </div>

            <input id="feedSpeed" class="range"
              type="range" min="10" max="150" step="5"
              value="${state.feedInterval}">
          </div>

          <div class="section">
            <div class="sectionHead">
              <span class="sectionIcon">${this.icon('move')}</span>
              <span class="sectionTitle">MOVIMIENTO WASD</span>
            </div>

            <div class="row">
              <span class="label">Controles WASD</span>
              <label class="switch">
                <input id="wasd" type="checkbox"
                  ${state.wasd ? 'checked' : ''}>
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
              <span class="label">Fuerza de direccion</span>
              <span class="value" id="directionValue">
                ${state.directionDistance}
              </span>
            </div>

            <input id="direction" class="range"
              type="range" min="1000" max="30000"
              step="1000" value="${state.directionDistance}">
          </div>
        </div>

        <footer class="footer">
          <div class="author">
            <div>
              <div class="overline">DEVELOPED BY</div>
              <div class="authorName">NicolasP [J A N]</div>
            </div>
            <a class="instagram"
               href="${APP.instagram}"
               target="_blank"
               rel="noopener noreferrer"
               title="Instagram @nick_poves">
              ${this.icon('instagram', 22)}
            </a>
          </div>
          <div class="copyright">
            <span>© 2026 NicolasP</span>
            <span>ESC · Mostrar / ocultar</span>
          </div>
        </footer>
      </section>
    `;

    this.bind();
  },

  find(id) {
    return this.shadow.getElementById(id);
  },

  refreshNick() {
    this.find('nick').textContent =
      state.nick || 'No detectado';

    this.find('nickStatus').textContent =
      state.nick ? 'Detectado' : 'Pendiente';

    this.find('nickStatus').classList.toggle(
      'wait',
      !state.nick
    );
  },

  bind() {
    const $ = id => this.find(id);

    const launcher = $('launcher');
    const panel = $('panel');

    document.addEventListener('np:toggle', () => {
      this.visible = !this.visible;
      launcher.style.display = this.visible ? 'flex' : 'none';

      if (!this.visible) {
        panel.classList.remove('open');
      }
    });

    launcher.addEventListener('click', () => {
      panel.classList.toggle('open');
    });

    $('close').addEventListener('click', () => {
      panel.classList.remove('open');
    });

    document.addEventListener('np:nick-updated', () => {
      this.refreshNick();
    });

    document.addEventListener('pointerdown', event => {
      if (event.target === document.querySelector('canvas')) {
        this.visible = false;
        launcher.style.display = 'none';
        panel.classList.remove('open');
      }
    }, true);

    const toggle = (id, key, callback) => {
      $(id).addEventListener('change', event => {
        state[key] = event.target.checked;
        save(key, state[key]);
        if (callback) callback();
      });
    };

    toggle('forceSkin', 'forceSkin');
    toggle('hideName', 'hideName');

    toggle('fastFeed', 'fastFeed', () => {
      if (!state.fastFeed) FeedEngine.stop();
    });

    toggle('wasd', 'wasd', () => {
      if (!state.wasd) MovementEngine.reset();
    });

    $('chooseSkin').addEventListener('click', () => {
      $('skinFile').click();
    });

    $('skinFile').addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== 'string') return;

        try {
          localStorage.setItem(KEYS.skin, reader.result);
        } catch {
          alert('Imagen demasiado grande para guardar.');
          return;
        }

        state.skin = reader.result;
        state.forceSkin = true;

        save('forceSkin', true);

        $('forceSkin').checked = true;
        $('skinStatus').textContent = 'Imagen cargada';

        try {
          window._localSkin = TOKEN;
        } catch {}
      };

      reader.readAsDataURL(file);
    });

    $('removeSkin').addEventListener('click', () => {
      state.skin = '';
      localStorage.removeItem(KEYS.skin);

      state.forceSkin = false;
      save('forceSkin', false);

      $('forceSkin').checked = false;
      $('skinStatus').textContent = 'Sin imagen';
      $('skinFile').value = '';
    });

    $('feedKey').value = state.feedKey.toUpperCase();

    $('feedKey').addEventListener('change', event => {
      const key = event.target.value.trim().toLowerCase();

      if (key.length !== 1 || 'wasd'.includes(key)) {
        event.target.value = state.feedKey.toUpperCase();
        return;
      }

      FeedEngine.stop();

      state.feedKey = key;
      save('feedKey', key);

      event.target.value = key.toUpperCase();
    });

    $('feedSpeed').addEventListener('input', event => {
      state.feedInterval = clamp(
        event.target.value, 10, 150, 30
      );

      save('feedInterval', state.feedInterval);

      $('feedValue').textContent =
        state.feedInterval + ' ms';

      if (state.feeding) {
        FeedEngine.stop();
        FeedEngine.start();
      }
    });

    $('direction').addEventListener('input', event => {
      state.directionDistance = clamp(
        event.target.value, 1000, 30000, 10000
      );

      save('directionDistance', state.directionDistance);

      $('directionValue').textContent =
        state.directionDistance.toLocaleString();
    });

    this.refreshNick();
  }
};

/* INITIALIZATION */

function bootstrap() {
  NickDetector.start();
  UI.mount();
}

SkinEngine.init();
NameEngine.init();
KeyboardController.init();

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    bootstrap,
    { once: true }
  );
} else {
  bootstrap();
}

})();
