// Rozhraní aplikace. Veškerý obsah se do stránky vkládá jako text (textContent), nikdy jako HTML.
(function () {
  const lessons = window.CONTENT.lessons;
  const wordsById = {};
  lessons.forEach((l) => l.words.forEach((w) => { wordsById[w.id] = w; }));
  const allWords = Object.values(wordsById);

  // Ikona a odstín barvy (0–359) podle tématu lekce; lekce bez záznamu dostane výchozí vzhled podle pořadí.
  const LESSON_STYLES = {
    t1: ['👋', 45], t2: ['🍞', 30], t3: ['👨‍👩‍👧', 340], t4: ['🔢', 220], t5: ['🏙️', 200], t6: ['📅', 260],
    t7: ['🎨', 300], t8: ['🏠', 20], t9: ['🏃', 150], t10: ['🛍️', 330], t11: ['👕', 280], t12: ['🩺', 0],
    t13: ['⛅', 195], t14: ['🎸', 270], t15: ['✈️', 210], t16: ['💬', 170], t17: ['💼', 35], t18: ['🐶', 25],
    t19: ['🌲', 130], t20: ['✏️', 55], t21: ['💻', 230], t22: ['🚌', 190], t23: ['🍎', 5], t24: ['🛋️', 15],
    t25: ['😊', 50], t26: ['🧭', 240],
  };

  function lessonStyle(lesson, index) {
    const [icon, hue] = LESSON_STYLES[lesson.id] || ['📘', (index * 47) % 360];
    return { icon, hue };
  }

  const hueStyle = (hue) => `--hue:${hue}`;

  const PRACTICE = {
    mistakes: { hue: 40, title: 'Typické chyby Čechů', icon: '⚠️', hint: 'Vyber správnou větu', items: window.EXTRAS.mistakes },
    falseFriends: { hue: 280, title: 'Falešní přátelé', icon: '🎭', hint: 'Slova, která se jen tváří česky', items: window.EXTRAS.falseFriends },
    pairs: { hue: 180, title: 'Minimální páry', icon: '👂', hint: 'Poslech: ship nebo sheep?', items: window.EXTRAS.pairs },
    listening: { hue: 200, title: 'Poslech', icon: '🎧', hint: 'Slyšíš slovo nebo větu: vyber význam nebo napiš', start: () => startListening() },
    sounds: { hue: 340, title: 'Výslovnost: th a w/v', icon: '👅', hint: 'Návod, slova, jazykolamy a poslech', start: () => showSounds() },
    tenses: { hue: 250, title: 'Gramatika: Present Perfect', icon: '⏳', hint: 'Časové osy a kvíz Past Simple × Present Perfect', start: () => showGrammar('tenses') },
    prepositions: { hue: 25, title: 'Gramatika: předložky místa', icon: '📍', hint: 'Schémata at / on / in a kvíz', start: () => showGrammar('prepositions') },
    timePrepositions: { hue: 80, title: 'Gramatika: předložky času', icon: '🕒', hint: 'Hodiny, kalendář a kvíz at / on / in', start: () => showGrammar('timePrepositions') },
    dialogs: { hue: 160, title: 'Dialogy ze situací', icon: '💬', hint: 'Restaurace, letiště, lékař… poslech a odpovědi', start: () => showDialogs() },
    sentences: { hue: 120, title: 'Skládání vět', icon: '🧩', hint: 'Seřaď slova do správné věty', start: () => startSentences() },
    matching: { hue: 20, title: 'Přiřazování dvojic', icon: '🔗', hint: 'Spoj anglické slovo s českým', start: () => startMatching() },
  };

  const PRON_LEGEND = [
    'VELKÁ písmena = přízvučná slabika.',
    'á í ó ú = dlouhá samohláska, opravdu ji protáhni (sí = see).',
    'th = neznělé th, jazyk mezi zuby (thrí = three); dh = znělé th (MAdhe = mother).',
    'w = zakulacené rty, ne české „v“ (wan = one).',
    'ér = dlouhé zavřené „e“, r se nečte (šért = shirt). Koncové r se v britské angličtině nečte.',
    'e na konci nebo v nepřízvučné slabice = krátké neutrální „e“ (heLOU); eə = „e“ a krátké neutrální „e“ (čeə = chair).',
  ];

  const NOTE_LABELS = {
    pronunciation: 'Výslovnost',
    falseFriend: 'Pozor, falešný přítel',
    grammar: 'Pozor, gramatika',
  };

  const app = document.getElementById('app');
  const backButton = document.getElementById('back');
  const tabBar = document.getElementById('tabs');
  let progress = Engine.loadProgress(window.localStorage);
  let currentAudio = null;
  let lastTab = 'path'; // naposledy zobrazená záložka, kam vede tlačítko Zpět
  let messageTimer = null; // časovač hlášky na Cestě (zpoždění oznámení a samovolné smazání)
  let renderingTab = null; // název záložky, kterou právě vykresluje showTab (jinak null)

  // ---------- pomocné funkce ----------

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    children.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function render(...nodes) {
    clearTimeout(messageTimer); // hláška patří k předchozí obrazovce
    app.replaceChildren(...nodes.flat().filter((n) => n !== null && n !== undefined && n !== false));
    const onTab = renderingTab !== null;
    backButton.hidden = onTab; // tlačítko Domů se na záložkách nezobrazuje
    tabBar.hidden = !onTab; // spodní lišta je jen na čtyřech hlavních obrazovkách
    document.body.classList.toggle('has-tabs', onTab);
    tabBar.querySelectorAll('button').forEach((b) => {
      if (b.dataset.tab === renderingTab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    renderingTab = null;
    window.scrollTo(0, 0);
  }

  const THEME_COLORS = { light: '#f5f5f7', dark: '#1c1c1e' };
  const THEME_LABELS = { system: '🖥️ Vzhled: podle systému', light: '☀️ Vzhled: světlý', dark: '🌙 Vzhled: tmavý' };
  const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({ meta: m, content: m.content, media: m.getAttribute('media') }));

  // Nastaví vzhled stránky a barvu horní lišty prohlížeče podle volby v nastavení.
  function applyTheme() {
    const theme = progress.settings.theme;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    themeMetas.forEach(({ meta, content, media }) => {
      meta.content = theme === 'system' ? content : THEME_COLORS[theme];
      if (theme === 'system' && media) meta.setAttribute('media', media);
      else meta.removeAttribute('media');
    });
  }

  function themeToggle() {
    return h('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        const next = Engine.THEMES[(Engine.THEMES.indexOf(progress.settings.theme) + 1) % Engine.THEMES.length];
        Engine.setTheme(progress, next);
        save();
        applyTheme();
        showTab('settings');
      },
    }, THEME_LABELS[progress.settings.theme]);
  }

  // Sova jako průvodce: ikona aplikace a bublina s krátkou hláškou.
  function owl(text) {
    return h('div', { class: 'owl' },
      h('img', { src: 'icons/icon-192.png', alt: '', width: '48', height: '48' }),
      h('div', { class: 'owl-bubble', role: 'status' }, text),
    );
  }

  // Hláška na úvodní obrazovce: nový uživatel > přerušená série > splněný cíl > obecný pozdrav.
  function homeOwl() {
    if (progress.xp === 0 && !Object.keys(progress.lessons).length) return owl(Engine.owlSay('newUser'));
    if (Engine.streakStatus(progress) === 'lost') return owl(Engine.owlSay('streakLost'));
    if (Engine.dailyStatus(progress).done) return owl(Engine.owlSay('goalDone'));
    return owl(Engine.owlSay('welcome'));
  }

  // ---------- odznaky ----------

  // Společné přidělení po události: nejdřív týdenní výzva (odznaky za výzvy na ní závisí), pak odznaky;
  // při jakékoli změně jedno uložení. Vrací nově získané odznaky a příznak právě splněné výzvy.
  function settleProgress() {
    const challengeDone = Challenges.complete(progress);
    const ctx = { knownWords: Engine.knownWords(progress), lessonsTotal: lessons.length, dialogsTotal: dialogs.length };
    const gained = Badges.award(progress, ctx);
    if (gained.length || challengeDone) save();
    return { gained, challengeDone };
  }

  // Karta „Nový odznak“ / „Týdenní výzva splněna“ pod skóre na výsledkové obrazovce; bez události nic (null).
  function badgeAwardCard(gained, challengeDone) {
    if (!gained.length && !challengeDone) return null;
    return h('div', {},
      h('div', { class: 'card badge-award' },
        challengeDone ? h('strong', {}, '🏅 Týdenní výzva splněna') : null,
        gained.length ? h('strong', {}, gained.length === 1 ? '🏅 Nový odznak' : '🏅 Nové odznaky') : null,
        gained.map((b) => h('div', { class: 'badge-award-row' }, `${b.icon} `, h('strong', {}, b.title), ` – ${b.hint}`)),
      ),
      gained.length ? owl(Engine.owlSay('badge')) : null, // sova jen u nového odznaku; samotná výzva má vlastní řádek
    );
  }

  // ---------- oslavy ----------

  const CONFETTI_PIECES = 28;
  const CONFETTI_COLORS = ['var(--accent)', 'var(--good)', 'var(--bad)'];
  const CONFETTI_MAX_MS = 3000;
  let goalCelebratedDay = '';
  // Po nahrazení postupu (start, import, reset): už splněný cíl se zpětně neoslavuje, nesplněný se oslaví při dosažení.
  function syncGoalCelebration() {
    goalCelebratedDay = Engine.dailyStatus(progress).done ? Engine.dayKey(new Date()) : '';
  }
  syncGoalCelebration();
  let lastCompletedLessonId = null; // jednorázové vyskočení bodu při příštím vykreslení Cesty

  // Konfety přes celou obrazovku; při omezeném pohybu nebo bez matchMedia nic. Nikdy nevyhodí chybu.
  function celebrate() {
    try {
      if (typeof window.matchMedia !== 'function') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const pieces = [];
      for (let i = 0; i < CONFETTI_PIECES; i++) {
        pieces.push(h('span', {
          class: 'confetti-piece',
          style: `left:${Math.round(Math.random() * 100)}%;animation-delay:${(Math.random() * 0.4).toFixed(2)}s;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
        }));
      }
      const box = h('div', { class: 'confetti', 'aria-hidden': 'true' }, pieces);
      let ended = 0;
      let timer = null;
      const remove = () => { clearTimeout(timer); box.remove(); }; // předčasné odstranění zruší i pojistný časovač
      box.addEventListener('animationend', () => { ended += 1; if (ended >= CONFETTI_PIECES) remove(); });
      document.body.append(box);
      timer = setTimeout(remove, CONFETTI_MAX_MS);
    } catch (e) { /* oslava je jen dekorace */ }
  }

  // Společné spouštění oslav po výsledku: nový odznak, splněná výzva, první splnění denního cíle v dni, případně 100 %.
  function celebrateResult(gained, challengeDone, perfect) {
    const today = Engine.dayKey(new Date());
    const goalReached = Engine.dailyStatus(progress).done && goalCelebratedDay !== today;
    if (goalReached) goalCelebratedDay = today;
    if (gained.length || challengeDone || goalReached || perfect) celebrate();
  }

  function save() {
    if (!Engine.saveProgress(window.localStorage, progress)) {
      alert('Postup se nepodařilo uložit do prohlížeče. Udělej si zálohu do souboru.');
    }
    updateStats();
  }

  function updateStats() {
    document.getElementById('xp').textContent = '⭐ ' + progress.xp;
    document.getElementById('streak').textContent = '🔥 ' + progress.streak.count;
  }

  // ---------- zvuk ----------

  function speakFallback(text, slow) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = slow ? 0.6 : 0.9;
    speechSynthesis.speak(u);
  }

  // Přehraje namluvený soubor; když chybí nebo selže, použije vestavěný hlas.
  function playFile(name, fallbackText, slow = false) {
    if (currentAudio) currentAudio.pause();
    const audio = new Audio('audio/' + name + '.mp3');
    currentAudio = audio;
    audio.addEventListener('error', () => speakFallback(fallbackText, slow), { once: true });
    audio.play().catch(() => {});
    return audio;
  }

  function play(word, { sentence = false, slow = false } = {}) {
    return playFile(word.id + (sentence ? '-s' : '') + (slow ? '-slow' : ''), sentence ? word.sentenceEn : word.en, slow);
  }

  // ---------- nahrávání vlastního hlasu ----------

  const recorder = Recorder.create({
    get mediaDevices() { return navigator.mediaDevices; },
    get MediaRecorder() { return window.MediaRecorder; },
    Blob: window.Blob,
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  });

  const RECORD_ERRORS = {
    denied: 'Mikrofon není povolený. Povol ho v nastavení prohlížeče a zkus to znovu.',
    nomic: 'Nenašel jsem mikrofon.',
    busy: 'Jiná nahrávka ještě běží.',
    failed: 'Nahrávání se nezdařilo.',
    unsupported: 'Tento prohlížeč nahrávání nepodporuje.',
  };

  // Vrátí { button, panel }: tlačítko 🎤 do řádku s přehráváním a panel s porovnáním pod něj.
  function recorderControls(word, sentence) {
    const maxMs = sentence ? 8000 : 4000;
    const button = h('button', { class: 'btn small', type: 'button' }, '🎤 Nahrát se');
    const message = h('div', { class: 'muted' });
    const compare = h('div', { class: 'row' });
    const panel = h('div', { class: 'rec-panel' }, compare, message);
    let session = null;
    let takeUrl = null;

    const playModel = () => play(word, { sentence });
    const playTake = () => {
      if (currentAudio) currentAudio.pause();
      currentAudio = new Audio(takeUrl);
      currentAudio.play().catch(() => {});
    };
    const playBoth = () => {
      const model = playModel();
      model.addEventListener('ended', playTake, { once: true });
    };

    function showCompare() {
      compare.replaceChildren(
        h('button', { class: 'btn small', type: 'button', onclick: playModel }, '▶️ Vzor'),
        h('button', { class: 'btn small', type: 'button', onclick: playTake }, '▶️ Ty'),
        h('button', { class: 'btn small primary', type: 'button', onclick: playBoth }, '🔁 Porovnat'),
      );
    }

    button.addEventListener('click', async () => {
      if (session) { session.stop(); return; }
      message.textContent = '';
      try {
        session = await recorder.record(maxMs);
      } catch (e) {
        message.textContent = RECORD_ERRORS[e.code] || RECORD_ERRORS.failed;
        return;
      }
      button.textContent = '⏹ Stop';
      message.textContent = 'Nahrávám… řekni to a klepni na Stop (zastaví se i samo).';
      let result;
      try {
        result = await session.done;
      } catch (e) {
        result = null;
      }
      session = null;
      button.textContent = takeUrl ? '🎤 Nahrát znovu' : '🎤 Nahrát se';
      if (!result || !result.blob.size) {
        message.textContent = 'Nic se nenahrálo, zkus to prosím znovu.';
        return;
      }
      if (takeUrl) URL.revokeObjectURL(takeUrl);
      takeUrl = URL.createObjectURL(result.blob);
      button.textContent = '🎤 Nahrát znovu';
      message.textContent = 'Hotovo. Poslechni si vzor a svou nahrávku. Zůstává jen v tomto okně, nikam se neposílá.';
      showCompare();
    });

    return { button, panel };
  }

  function soundButtons(word, sentence, { record = false } = {}) {
    const row = h('div', { class: 'row' },
      h('button', { class: 'btn small', type: 'button', onclick: () => play(word, { sentence }) }, '🔊 Přehrát'),
      h('button', { class: 'btn small', type: 'button', onclick: () => play(word, { sentence, slow: true }) }, '🐢 Pomalu'),
    );
    if (!record || !recorder.isSupported()) return row;
    const controls = recorderControls(word, sentence);
    row.append(controls.button);
    return h('div', {}, row, controls.panel);
  }

  function pronLine(word) {
    return progress.settings.showPron ? h('div', { class: 'pron' }, word.pron) : null;
  }

  function pronLegend() {
    if (!progress.settings.showPron) return null;
    return h('details', { class: 'card' },
      h('summary', {}, 'Jak číst přepis výslovnosti'),
      h('p', { class: 'muted' }, 'Je to zjednodušená pomůcka, ne přesná fonetika. Vždy poslouchej nahrávku.'),
      h('ul', {}, PRON_LEGEND.map((line) => h('li', {}, line))),
    );
  }

  function noteBox(word) {
    if (!word.note) return null;
    return h('div', { class: 'note' }, h('strong', {}, (NOTE_LABELS[word.noteType] || 'Poznámka') + ': '), word.note);
  }

  // ---------- denní cíl ----------

  function goalLine() {
    const g = Engine.dailyStatus(progress);
    return h('p', { class: 'muted' }, g.done ? '🎯 Denní cíl splněn!' : `🎯 Dnešní cíl: ${g.xp} z ${g.goal} bodů`);
  }

  function goalCard() {
    const g = Engine.dailyStatus(progress);
    const chips = Engine.DAILY_GOALS.map((value) => h('button', {
      class: 'btn small' + (value === g.goal ? ' primary' : ''),
      type: 'button',
      'aria-pressed': String(value === g.goal),
      onclick: () => { Engine.setDailyGoal(progress, value); save(); showTab('path', { keepScroll: true }); },
    }, String(value)));
    return h('div', { class: 'card' },
      h('strong', {}, g.done ? '🎯 Denní cíl splněn!' : '🎯 Denní cíl'),
      h('div', { class: 'progress' }, h('div', { style: `width:${Math.round(g.ratio * 100)}%` })),
      h('div', { class: 'muted' }, `Dnes ${g.xp} z ${g.goal} bodů`),
      h('div', { class: 'muted' }, 'Cíl (body za den):'),
      h('div', { class: 'row' }, chips),
    );
  }

  // ---------- záložky spodní lišty ----------

  const isDone = (lesson) => Boolean(progress.lessons[lesson.id] && progress.lessons[lesson.id].done);

  // Index první odemčené nedokončené lekce (aktuální na cestě, karta Pokračovat); -1, když žádná není.
  function currentLessonIndex() {
    return lessons.findIndex((l, i) => Engine.isLessonUnlocked(progress, lessons, i) && !isDone(l));
  }

  // Klikatá cesta lekcemi: jedna SVG křivka a nad ní tlačítka bodů na vypočtených souřadnicích.
  // Aktuální je první odemčená nedokončená lekce; zamčený bod jen ukáže hlášku v živé oblasti pod cestou.
  // Šířka cesty: nejvýš 320 px, na úzkém displeji podle místa v obsahu (bez odsazení); v jsdom je 0 → 320.
  function pathWidth() {
    const cs = window.getComputedStyle(app);
    const inner = app.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return inner > 0 ? Math.min(320, inner) : 320;
  }

  // Hláška v živé oblasti: nejdřív se vymaže a za chvilku znovu nastaví (čtečka ji oznámí i při opakování), po čase zmizí.
  const MESSAGE_TIMEOUT = 4000;
  const MESSAGE_REANNOUNCE_DELAY = 50;
  function showPathMessage(message, textValue) {
    clearTimeout(messageTimer);
    message.textContent = '';
    messageTimer = setTimeout(() => {
      message.textContent = textValue;
      messageTimer = setTimeout(() => { message.textContent = ''; }, MESSAGE_TIMEOUT);
    }, MESSAGE_REANNOUNCE_DELAY);
  }

  const SECTION_HUES = [210, 25, 160, 280, 340]; // odstín pruhu podle pořadí úseku

  function pathMap(message) {
    const width = pathWidth();
    const layoutOptions = { width, amplitude: Math.round(width / 4), sectionStarts: PathMap.SECTIONS.map((s) => s.start) };
    const pathHeight = PathMap.height(lessons.length, layoutOptions);
    const points = PathMap.layout(lessons.length, layoutOptions);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'path-line');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(pathHeight));
    svg.setAttribute('viewBox', `0 0 ${width} ${pathHeight}`);
    svg.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('class', 'path-line-bg');
    line.setAttribute('d', PathMap.curve(points));
    svg.append(line);

    const currentIndex = currentLessonIndex();
    const justDoneId = lastCompletedLessonId;
    lastCompletedLessonId = null; // vyskočení hraje jen při prvním vykreslení
    const steps = lessons.map((lesson, index) => {
      const unlocked = Engine.isLessonUnlocked(progress, lessons, index);
      const done = isDone(lesson);
      const isCurrent = index === currentIndex;
      const best = done ? Math.round((progress.lessons[lesson.id].best || 0) * 100) : null;
      const state = done ? 'done' : isCurrent ? 'current' : unlocked ? 'open' : 'locked';
      const style = lessonStyle(lesson, index);
      const point = points[index];
      const wordCount = `${lesson.words.length} ${wordForm(lesson.words.length)}`;
      const stateLabel = done ? `hotovo, nejlepší výsledek ${best} %`
        : isCurrent ? `další lekce, ${wordCount}` : unlocked ? 'otevřeno' : 'zamčeno';
      const label = `Lekce ${index + 1}: ${lesson.title}, ${stateLabel}`;
      const node = h('button', {
        class: `path-node ${state}${lesson.id === justDoneId ? ' just-done' : ''}`, type: 'button', 'aria-label': label, style: hueStyle(style.hue),
        onclick: () => {
          if (state === 'locked') showPathMessage(message, 'Dokonči předchozí lekci.');
          else showIntro(lesson);
        },
      },
      h('span', { class: 'path-icon', 'aria-hidden': 'true' }, style.icon),
      done ? h('span', { class: 'path-badge', 'aria-hidden': 'true' }, '✅') : null,
      state === 'locked' ? h('span', { class: 'path-badge', 'aria-hidden': 'true' }, '🔒') : null);
      if (state === 'locked') node.setAttribute('aria-disabled', 'true');
      return h('div', { class: 'path-step', style: `left:${point.x}px;top:${point.y}px;transform:translate(-50%,-50%)` },
        node,
        h('span', { class: 'path-caption' }, `${index + 1}. ${lesson.title}`, done ? h('span', { class: 'path-best' }, `${best} %`) : null,
          isCurrent ? h('span', { class: 'path-words' }, wordCount) : null),
        isCurrent
          ? h('button', { class: 'btn small primary path-start' + (point.x > width / 2 ? ' left' : ''), type: 'button', onclick: () => showIntro(lesson) }, 'Začít')
          : null);
    });

    // Pruhy úseků: nadpis a počet hotových lekcí, ležící na cestě nad první lekcí úseku.
    const banners = PathMap.SECTIONS.filter((s) => s.start < lessons.length).map((section, i, all) => {
      const end = i + 1 < all.length ? all[i + 1].start : lessons.length;
      const total = end - section.start;
      const doneCount = lessons.slice(section.start, end).filter(isDone).length;
      return h('h2', { class: 'path-section' + (doneCount === total ? ' done' : ''), style: `top:${PathMap.bannerY(points, section.start, layoutOptions)}px;${hueStyle(SECTION_HUES[i % SECTION_HUES.length])}` },
        h('span', {}, section.title),
        h('span', { class: 'path-section-count' }, `${doneCount === total ? '✅ ' : ''}${doneCount} / ${total} hotovo`));
    });

    return h('div', { class: 'path', style: `width:${width}px;height:${pathHeight}px` }, svg, banners, steps);
  }

  // Po vykreslení Cesty odroluje aktuální bod (nebo poslední, když je vše hotové) doprostřed obrazovky.
  function scrollPathIntoView() {
    // Při zobrazené připomínce opakování zůstane stránka nahoře, ať je připomínka vidět.
    if (Engine.dueWords(progress, allWords).length && progress.settings.reviewReminder) return;
    const target = app.querySelector('.path-node.current') || [...app.querySelectorAll('.path-node')].pop();
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' });
  }

  // Obsah záložky Cesta: úvod, denní cíl, připomínka opakování, Pokračovat a cesta lekcí.
  function pathScreen() {
    const message = h('p', { class: 'path-message', role: 'status', 'aria-live': 'polite' });
    const list = [pathMap(message), message];

    const due = Engine.dueWords(progress, allWords);
    // Výrazná připomínka nahoře (jde vypnout v nastavení); vypnutá varianta nechá opakování v seznamu procvičování.
    const reviewReminder = due.length && progress.settings.reviewReminder
      ? h('div', { class: 'card reminder' },
        h('strong', {}, `🔁 Dnes na tebe čeká ${due.length} ${wordForm(due.length)} k zopakování`),
        h('div', { class: 'muted' }, 'Krátké opakování tě udrží v rytmu a slova ti zůstanou v hlavě.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => startReview(due) }, 'Zopakovat teď'))
      : null;

    // První odemčená lekce, kterou jsi ještě nedokončil.
    const nextLesson = lessons[currentLessonIndex()];
    const continueCard = nextLesson
      ? h('div', { class: 'card lesson', style: hueStyle(lessonStyle(nextLesson, lessons.indexOf(nextLesson)).hue) },
        h('span', { class: 'badge', 'aria-hidden': 'true' }, lessonStyle(nextLesson, lessons.indexOf(nextLesson)).icon),
        h('div', { class: 'info' }, h('strong', {}, 'Pokračovat'), h('div', { class: 'muted' }, nextLesson.title)),
        h('button', { class: 'btn small primary', type: 'button', onclick: () => showIntro(nextLesson) }, 'Pokračovat'))
      : null;

    return [
      h('h1', {}, 'Učíme se anglicky'),
      h('p', { class: 'muted' }, `Znáš už ${Engine.knownWords(progress)} slov z ${Object.keys(wordsById).length}.`),
      homeOwl(),
      goalCard(),
      reviewReminder,
      continueCard,
      challengeCard(),
      badgeStrip(),
      list,
    ];
  }

  // Obsah záložky Procvičování: opakování (když je připomínka vypnutá) a karty procvičování.
  function practiceScreen() {
    const due = Engine.dueWords(progress, allWords);
    const reviewRow = due.length && !progress.settings.reviewReminder
      ? h('div', { class: 'card lesson' },
        h('span', { class: 'badge' }, '🔁'),
        h('div', { class: 'info' }, h('strong', {}, 'Opakování'), h('div', { class: 'muted' }, `K zopakování: ${due.length} ${wordForm(due.length)}`)),
        h('button', { class: 'btn small primary', type: 'button', onclick: () => startReview(due) }, 'Zopakovat'))
      : null;
    return [
      h('h1', {}, 'Procvičování'),
      reviewRow,
      Object.keys(PRACTICE).map(practiceCard),
    ];
  }

  // Obsah záložky Nastavení: přepínače, záloha a smazání postupu.
  function settingsScreen() {
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: '', onchange: importFile });
    return [
      h('h1', {}, 'Nastavení'),
      h('button', {
        class: 'btn', type: 'button', 'aria-pressed': String(progress.settings.showPron),
        onclick: () => { Engine.setShowPron(progress, !progress.settings.showPron); save(); showTab('settings'); },
      }, progress.settings.showPron ? '✅ Přepis výslovnosti: zapnuto' : '⬜ Přepis výslovnosti: vypnuto'),
      h('button', {
        class: 'btn', type: 'button', 'aria-pressed': String(progress.settings.reviewReminder),
        onclick: () => { Engine.setReviewReminder(progress, !progress.settings.reviewReminder); save(); showTab('settings'); },
      }, progress.settings.reviewReminder ? '✅ Připomínka opakování: zapnuto' : '⬜ Připomínka opakování: vypnuto'),
      themeToggle(),
      voiceToggle(() => showTab('settings')),
      h('h2', {}, 'Záloha postupu'),
      h('p', { class: 'muted' }, 'Postup je uložený v prohlížeči. Pro jistotu si ho občas stáhni do souboru.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: exportFile }, '⬇️ Stáhnout zálohu'),
        h('button', { class: 'btn small', type: 'button', onclick: () => fileInput.click() }, '⬆️ Obnovit ze zálohy'),
      ),
      h('h2', {}, 'Začít znovu'),
      h('p', { class: 'muted' }, 'Smaže všechny body, sérii, dokončené lekce i statistiky slov. Denní cíl zůstane.'),
      h('button', { class: 'btn small bad', type: 'button', onclick: resetAll }, '🗑️ Smazat postup'),
      fileInput,
    ];
  }

  const TAB_SCREENS = {
    path: pathScreen,
    practice: practiceScreen,
    progress: () => [progressScreen(), statsSection()],
    settings: settingsScreen,
  };

  // Vykreslí jednu ze čtyř hlavních obrazovek se spodní lištou.
  // S { keepScroll: true } (změna denního cíle) se zachová pozice posunu a neodroluje se na aktuální bod.
  function showTab(name, { keepScroll = false } = {}) {
    const y = window.scrollY;
    renderingTab = name;
    lastTab = name;
    render(...TAB_SCREENS[name]());
    if (keepScroll) window.scrollTo(0, y);
    else if (name === 'path') scrollPathIntoView(); // render() posouvá nahoru, odrolování na aktuální bod následuje po něm
  }

  // Návrat na Cestu (úvodní záložka).
  function showHome() {
    showTab('path');
  }

  const showPractice = () => showTab('practice');

  function practiceSubtitle(kind, def, done) {
    if (kind === 'dialogs') {
      const finished = dialogs.filter((d) => progress.dialogs[d.id]).length;
      return `${def.hint} · hotovo ${finished} z ${dialogs.length}`;
    }
    return done ? `${def.hint} · nejlepší výsledek ${Math.round(done.best * 100)} %` : def.hint;
  }

  function practiceCard(kind) {
    const def = PRACTICE[kind];
    const done = progress.practice[kind];
    return h('div', { class: 'card lesson', style: hueStyle(def.hue) },
      h('span', { class: 'badge', 'aria-hidden': 'true' }, def.icon),
      h('div', { class: 'info' }, h('strong', {}, def.title),
        h('div', { class: 'muted' }, practiceSubtitle(kind, def, done))),
      h('button', { class: 'btn small primary', type: 'button', onclick: () => startPractice(kind) }, done ? 'Znovu' : 'Začít'),
    );
  }

  function wordForm(n) {
    return n === 1 ? 'slovo' : n >= 2 && n <= 4 ? 'slova' : 'slov';
  }

  function statsSection() {
    const st = Engine.stats(progress, allWords);
    if (!st.seen) return null;
    return h('div', {},
      h('h2', {}, 'Statistiky'),
      h('div', { class: 'card' },
        h('div', {}, `Znáš ${st.known} slov, ještě se učíš ${st.learning}, nové čeká ${st.total - st.seen}.`),
        h('div', {}, st.accuracy === null ? '' : `Úspěšnost odpovědí: ${Math.round(st.accuracy * 100)} %`),
        st.weak.length
          ? h('div', {},
            h('h2', {}, 'Slabá místa'),
            st.weak.map((x) => h('div', {}, h('strong', {}, x.word.en), ` – ${x.word.cs} (chyb: ${x.wrong}, správně: ${x.correct})`)))
          : null,
      ),
    );
  }

  // ---------- obrazovka Pokrok ----------

  const WEEKDAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

  function meterRow(label, done, total) {
    return h('div', {},
      h('div', {}, h('strong', {}, label), ` ${done} z ${total}`),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(done), 'aria-label': label },
        h('div', { style: `width:${total ? Math.round((done / total) * 100) : 0}%` })),
    );
  }

  // Tvar slova „den“ podle počtu (1 den, 2–4 dny, jinak dní).
  function dayForm(n) {
    return n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní';
  }

  function weekChart() {
    const days = Engine.lastDays(progress, 7);
    const max = Math.max(1, ...days.map((d) => d.xp));
    const total = days.reduce((sum, d) => sum + d.xp, 0);
    const chart = h('div', { class: 'chart', role: 'img', 'aria-label': 'Body za posledních 7 dní: ' + days.map((d) => `${WEEKDAYS[d.weekday]} ${d.xp}`).join(', ') },
      days.map((d, i) => h('div', { class: 'chart-col' },
        h('div', { class: 'chart-value' }, d.xp ? String(d.xp) : ''),
        h('div', { class: 'chart-track' }, h('div', { class: 'chart-bar' + (i === days.length - 1 ? ' today' : ''), style: `height:${Math.round((d.xp / max) * 100)}%` })),
        h('div', { class: 'muted' }, WEEKDAYS[d.weekday]),
      )));
    return h('div', { class: 'card' },
      h('strong', {}, 'Body za posledních 7 dní'),
      chart,
      h('div', { class: 'muted' }, `Celkem ${total} bodů, denní cíl je ${progress.settings.dailyGoal}.`),
    );
  }

  // Datum zisku odznaku (čeština); neplatný čas dá prázdný text.
  const badgeDate = (time) => new Date(time).toLocaleDateString('cs-CZ');

  // Odznaky z postupu, které katalog zná (neznámá id se ignorují), od nejnovějšího.
  function earnedBadges() {
    return Object.entries(progress.badges || {})
      .map(([id, time]) => ({ badge: Badges.byId(id), time }))
      .filter((x) => x.badge)
      .sort((a, b) => b.time - a.time);
  }

  // Galerie v Pokroku: získané s ikonou a datem, ostatní šedé s nápovědou „co udělat“.
  function badgeGallery() {
    const earned = new Map(earnedBadges().map((x) => [x.badge.id, x.time]));
    return h('div', {},
      h('h2', {}, 'Odznaky'),
      h('p', { class: 'muted' }, `Získáno ${earned.size} z ${Badges.CATALOG.length}`),
      h('div', { class: 'badge-grid' }, Badges.CATALOG.map((b) => (earned.has(b.id)
        ? h('div', { class: 'badge-tile earned', 'aria-label': `${b.title}, získáno ${badgeDate(earned.get(b.id))}` },
          h('div', { class: 'badge-tile-icon', 'aria-hidden': 'true' }, b.icon),
          h('strong', {}, b.title),
          h('div', { class: 'muted' }, badgeDate(earned.get(b.id))))
        : h('div', { class: 'badge-tile locked', 'aria-label': `${b.title}, zamčeno: ${b.hint}` },
          h('div', { class: 'badge-tile-icon', 'aria-hidden': 'true' }, '🔒'),
          h('strong', {}, b.title),
          h('div', { class: 'muted' }, b.hint))))),
    );
  }

  // Karta týdenní výzvy na Cestě: název, nápověda, ukazatel a zbývající dny (po splnění jen potvrzení).
  function challengeCard() {
    const c = Challenges.current(progress);
    return h('div', { class: 'card challenge-card' },
      h('strong', {}, `🎯 Týdenní výzva: ${c.title}`),
      h('div', { class: 'muted' }, c.hint),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(c.goal), 'aria-valuenow': String(c.value), 'aria-label': c.title },
        h('div', { style: `width:${Math.round((c.value / c.goal) * 100)}%` })),
      h('div', {}, `${c.value} / ${c.goal}`),
      h('div', { class: 'muted' }, c.done ? '✅ Výzva splněna – další přijde v pondělí' : `Zbývá ${c.daysLeft} ${dayForm(c.daysLeft)}`),
    );
  }

  // Řada 3 naposledy získaných odznaků na Cestě; bez odznaků nic (null).
  function badgeStrip() {
    const recent = earnedBadges().slice(0, 3);
    if (!recent.length) return null;
    return h('div', { class: 'card badge-strip' },
      h('div', { class: 'row' }, recent.map((x) => h('div', { class: 'badge-chip', 'data-badge': x.badge.id },
        h('div', { class: 'badge-tile-icon', 'aria-hidden': 'true' }, x.badge.icon),
        h('div', { class: 'muted' }, x.badge.title)))),
      h('button', { class: 'btn small', type: 'button', onclick: () => showTab('progress') }, 'Všechny odznaky'),
    );
  }

  function progressScreen() {
    const st = Engine.stats(progress, allWords);
    const lessonsDone = lessons.filter((l) => progress.lessons[l.id] && progress.lessons[l.id].done).length;
    const dialogsDone = dialogs.filter((d) => progress.dialogs[d.id]).length;
    return [
      h('h1', {}, 'Můj pokrok'),
      h('div', { class: 'card' },
        h('div', {}, `⭐ ${progress.xp} bodů`),
        h('div', {}, `🔥 série ${progress.streak.count} ${dayForm(progress.streak.count)} za sebou`),
        goalLine(),
      ),
      weekChart(),
      h('div', { class: 'card' },
        meterRow('Slova, která znáš', st.known, st.total),
        meterRow('Hotové lekce', lessonsDone, lessons.length),
        meterRow('Hotové dialogy', dialogsDone, dialogs.length),
        st.accuracy === null ? null : h('div', { class: 'muted' }, `Úspěšnost odpovědí u slov: ${Math.round(st.accuracy * 100)} %`),
      ),
      badgeGallery(),
      h('h2', {}, 'Procvičování'),
      h('div', { class: 'card' }, Object.keys(PRACTICE).map((kind) => {
        const done = progress.practice[kind];
        return h('div', {}, h('strong', {}, PRACTICE[kind].title),
          done ? ` – nejlepší ${Math.round(done.best * 100)} %, ${done.plays}× dokončeno` : ' – ještě nezkoušeno');
      })),
    ];
  }

  function exportFile() {
    const blob = new Blob([Engine.exportProgress(progress)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `anglictina-zaloha-${Engine.dayKey(new Date())}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function resetAll() {
    const sure = confirm(
      'Opravdu smazat veškerý postup?\n\nZmizí všechny body, série dní, dokončené lekce i statistiky slov. '
      + 'Tuto akci nelze vrátit zpět.\n\nDoporučujeme nejdřív stáhnout zálohu.',
    );
    if (!sure) return;
    progress = Engine.resetProgress(progress);
    syncGoalCelebration();
    save();
    showTab('settings');
  }

  function importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = Engine.importProgress(String(reader.result));
      if (!imported) {
        alert('Tento soubor není platná záloha aplikace.');
      } else if (confirm('Obnovením ze zálohy přepíšeš současný postup. Pokračovat?')) {
        progress = imported;
        syncGoalCelebration();
        settleProgress(); // tiché doplnění výzvy a odznaků podle importovaného postupu (uloží jen při změně)
        save();
        showTab('settings');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // ---------- úvod lekce (karty se slovy) ----------

  function showIntro(lesson) {
    render(
      h('h1', {}, lesson.title),
      h('p', { class: 'muted' }, 'Nejdřív si slova poslechni, pak tě čeká procvičování.'),
      pronLegend(),
      lesson.words.map((w) => h('div', { class: 'card' },
        h('div', { class: 'big-word' }, w.en),
        pronLine(w),
        h('div', {}, w.cs),
        soundButtons(w, false, { record: true }),
        h('p', { class: 'sentence' }, w.sentenceEn),
        h('div', { class: 'muted' }, w.sentenceCs),
        soundButtons(w, true, { record: true }),
        noteBox(w),
      )),
      h('button', { class: 'btn primary', type: 'button', onclick: () => startLesson(lesson) }, 'Začít procvičování'),
      h('button', { class: 'btn', type: 'button', onclick: showHome }, 'Zpět'),
    );
  }

  // ---------- cvičení ----------

  function startLesson(lesson) {
    const exercises = Engine.buildLesson(lesson);
    runExercise({
      lesson,
      queue: exercises,
      index: 0,
      total: exercises.length,
      firstTry: 0,
      firstTryCorrect: 0,
      xpEarned: 0,
    });
  }

  function startPractice(kind) {
    if (PRACTICE[kind].start) return PRACTICE[kind].start();
    const exercises = Engine.buildPractice(kind, PRACTICE[kind].items);
    runPractice({ kind, queue: exercises, index: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0 });
  }

  function runPractice(state) {
    if (state.index >= state.queue.length) return showPracticeResult(state);
    const ex = state.queue[state.index];
    const bar = h('div', { class: 'progress' }, h('div', { style: `width:${Math.round((state.index / state.queue.length) * 100)}%` }));
    const feedback = h('div');
    const body = h('div', {}, h('h2', {}, ex.prompt));
    if (ex.big) body.append(h('div', { class: 'big-word' }, ex.big));
    if (ex.audioNow) {
      body.append(h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => playFile(ex.audioNow, ex.speakNow) }, '🔊 Přehrát'),
        ex.audioSlow ? h('button', { class: 'btn small', type: 'button', onclick: () => playFile(ex.audioSlow, ex.speakNow, true) }, '🐢 Pomalu') : null));
    }

    function finish(ok, typo = false) {
      if (!ex.retry) {
        state.firstTry += 1;
        if (ok) {
          state.firstTryCorrect += 1;
          Engine.addXp(progress, Engine.XP_PER_CORRECT);
          state.xpEarned += Engine.XP_PER_CORRECT;
        }
      }
      if (!ok) state.queue = Engine.requeue(state.queue, ex);
      save();
      feedback.replaceChildren(
        h('div', { class: 'feedback ' + (ok ? 'good' : 'bad') },
          h('strong', {}, typo ? 'Skoro! Pozor na překlep.' : ok ? 'Správně!' : 'Chyba, ale to se stane.'),
          h('div', {}, ex.explanation),
          ex.afterText ? h('div', { class: 'sentence' }, ex.afterText) : null,
        ),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { state.index += 1; runPractice(state); } }, 'Pokračovat'),
      );
      feedback.querySelector('.btn.primary').focus();
      if (ex.audioAfter) playFile(ex.audioAfter, ex.speakAfter);
    }

    if (ex.typed) {
      const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Napiš větu' });
      const check = h('button', { class: 'btn primary', type: 'button' }, 'Zkontrolovat');
      const submit = () => {
        if (!input.value.trim()) return;
        input.disabled = true;
        check.disabled = true;
        const result = Engine.checkDictation(input.value, ex.answer);
        finish(result !== 'wrong', result === 'typo');
      };
      check.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      body.append(input, check);
      render(bar, body, feedback);
      input.focus();
      return;
    }

    const buttons = ex.options.map((opt) => {
      const b = h('button', { class: 'btn', type: 'button' }, opt.text, opt.sceneId ? miniDiagram(opt.sceneId) : null);
      b.addEventListener('click', () => {
        buttons.forEach((x) => { x.disabled = true; });
        b.classList.add(opt.correct ? 'good' : 'bad');
        if (!opt.correct) buttons[ex.options.findIndex((o) => o.correct)].classList.add('good');
        finish(opt.correct);
      });
      return b;
    });
    body.append(...buttons);

    render(bar, body, feedback);
  }

  // Poslech: slovo -> význam, věta -> překlad, diktát věty. Bere slova, která už jsi viděl; když jich je málo, všechna.
  function startListening() {
    const seen = allWords.filter((w) => progress.words[w.id]);
    const pool = seen.length >= 12 ? seen : allWords;
    const exercises = Engine.buildPractice('listening', pool);
    runPractice({ kind: 'listening', queue: exercises, index: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0 });
  }

  // ---------- výslovnost th a w/v ----------

  // Minimální páry, které se liší v th nebo w/v (poznámka páru obsahuje „th“ nebo „w / v“).
  const soundPairs = window.EXTRAS.pairs.filter((p) => /\bth\b|w \/ v/.test(p.note));

  function showSounds() {
    const sounds = window.EXTRAS.sounds;
    render(
      h('h1', {}, 'Výslovnost: th a w/v'),
      h('p', { class: 'muted' }, 'Tyhle zvuky česky nemáme. Přečti si návod, poslechni slova a zkus se nahrát.'),
      sounds.guide.map((g) => h('div', { class: 'card' },
        h('strong', {}, g.title), h('span', { class: 'muted' }, ' – ' + g.examples),
        h('p', {}, g.text),
      )),
      pronLegend(),
      h('h2', {}, 'Slova'),
      sounds.words.map((w) => h('div', { class: 'card' },
        h('div', { class: 'big-word' }, w.en),
        pronLine(w),
        h('div', {}, w.cs),
        soundButtons(w, false, { record: true }),
        h('p', { class: 'sentence' }, w.sentenceEn),
        h('div', { class: 'muted' }, w.sentenceCs),
        soundButtons(w, true, { record: true }),
        noteBox(w),
      )),
      h('h2', {}, 'Jazykolamy'),
      sounds.twisters.map((t) => h('div', { class: 'card' },
        h('p', { class: 'sentence' }, t.sentenceEn),
        h('div', { class: 'muted' }, t.sentenceCs + ' (' + t.goal + ')'),
        soundButtons(t, true, { record: true }),
      )),
      h('button', { class: 'btn primary', type: 'button', onclick: startSoundsQuiz }, 'Poslechové cvičení'),
      h('button', { class: 'btn', type: 'button', onclick: showPractice }, 'Zpět'),
    );
  }

  function startSoundsQuiz() {
    const exercises = Engine.buildPractice('sounds', soundPairs);
    runPractice({ kind: 'sounds', queue: exercises, index: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0 });
  }

  // ---------- gramatika: časové osy a kvíz ----------

  // Skupiny gramatiky: stejné obrazovky, jiný obsah (časové osy × schémata míst).
  const GRAMMAR_GROUPS = {
    tenses: {
      title: 'Gramatika: Present Perfect',
      intro: 'Čeština má jen minulý, přítomný a budoucí čas. Na časových osách uvidíš, kdy se děj stal a jak se dotýká přítomnosti.',
      data: window.EXTRAS.grammar,
      quizLabel: 'Kvíz: Kam patří věta?',
      kind: 'tenses',
    },
    prepositions: {
      title: 'Gramatika: předložky místa',
      intro: 'Česky řekneme skoro vždy „v“ nebo „na“. Angličtina se ptá, jestli je místo bod, plocha, nebo prostor: at, on, in.',
      data: window.EXTRAS.prepositions,
      quizLabel: 'Kvíz: Která předložka?',
      kind: 'prepositions',
    },
    timePrepositions: {
      title: 'Gramatika: předložky času',
      intro: 'Česky řekneme „v“, „o“ nebo „na“. Angličtina se ptá, jestli je čas okamžik, den, nebo delší úsek: at, on, in.',
      data: window.EXTRAS.timePrepositions,
      quizLabel: 'Kvíz: Která předložka?',
      kind: 'timePrepositions',
    },
  };
  const grammarScenesById = Object.fromEntries(
    Object.values(GRAMMAR_GROUPS).flatMap((g) => g.data.scenes.map((sc) => [sc.id, sc])));

  // Scéna s `elements` se kreslí schématem míst, scéna s `events` časovou osou.
  function sceneSvg(scene, visibleIds, options) {
    return scene.elements ? Spatial.svg(document, scene, visibleIds, options) : Timeline.svg(document, scene, visibleIds, options);
  }

  function showGrammar(groupKey = 'tenses') {
    const group = GRAMMAR_GROUPS[groupKey];
    render(
      h('h1', {}, group.title),
      h('p', { class: 'muted' }, group.intro),
      group.data.scenes.map((scene, index) => h('div', { class: 'card lesson' },
        h('div', { class: 'info' }, h('strong', {}, `${index + 1}. ${scene.title}`)),
        h('button', { class: 'btn small primary', type: 'button', onclick: () => showGrammarScene(scene, 0, groupKey) }, 'Otevřít'),
      )),
      h('button', { class: 'btn primary', type: 'button', onclick: () => startGrammarQuiz(groupKey) }, group.quizLabel),
      h('button', { class: 'btn', type: 'button', onclick: showPractice }, 'Zpět'),
    );
  }

  function showGrammarScene(scene, step = 0, groupKey = 'tenses') {
    const current = scene.steps[step];
    const last = step === scene.steps.length - 1;
    render(
      h('h1', {}, scene.title),
      h('p', { class: 'scene-text' }, scene.text),
      sceneSvg(scene, current.show, { label: current.text }),
      h('p', { class: 'muted' }, `Krok ${step + 1} z ${scene.steps.length}`),
      h('div', { class: 'card' }, current.text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => (step === 0 ? showGrammar(groupKey) : showGrammarScene(scene, step - 1, groupKey)) }, 'Zpět'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => (last ? showGrammar(groupKey) : showGrammarScene(scene, step + 1, groupKey)) }, last ? 'Hotovo' : 'Další'),
      ),
      h('h2', {}, 'Příklady'),
      scene.sentences.map((sentence) => h('div', { class: 'card' },
        h('p', { class: 'sentence' }, sentence.en),
        pronLine(sentence),
        h('div', { class: 'muted' }, sentence.cs),
        h('button', { class: 'btn small', type: 'button', onclick: () => playFile(sentence.id, sentence.en) }, '🔊 Přehrát'),
      )),
    );
  }

  // Kvíz skupiny gramatiky: `kind` a otázky bere z GRAMMAR_GROUPS.
  function startGrammarQuiz(groupKey) {
    const group = GRAMMAR_GROUPS[groupKey];
    const exercises = Engine.buildPractice(group.kind, group.data.quiz);
    runPractice({ kind: group.kind, queue: exercises, index: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0, retry: () => startGrammarQuiz(groupKey) });
  }

  // Malé schéma celé scény (všechny prvky) pro možnost v kvízu.
  function miniDiagram(sceneId) {
    const scene = grammarScenesById[sceneId];
    const ids = (scene.elements || scene.events).map((x) => x.id);
    const svg = sceneSvg(scene, ids, { mini: true });
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role');
    return svg;
  }

  // ---------- dialogy ze situací ----------

  const dialogs = window.EXTRAS.dialogs;

  function showDialogs() {
    const finished = dialogs.filter((d) => progress.dialogs[d.id]).length;
    render(
      h('h1', {}, 'Dialogy ze situací'),
      h('p', { class: 'muted' }, 'Nejdřív si dialog přečti a poslechni, pak odpovídej za svou roli.'),
      h('p', { class: 'muted' }, `Hotovo ${finished} z ${dialogs.length} dialogů.`),
      voiceToggle(showDialogs),
      dialogs.map((d) => {
        const done = progress.dialogs[d.id];
        return h('div', { class: 'card lesson' },
          h('span', { class: 'badge' }, done ? '✅' : '💬'),
          h('div', { class: 'info' }, h('strong', {}, d.title),
            h('div', { class: 'muted' }, done ? `Nejlepší výsledek ${Math.round(done.best * 100)} %` : `${d.lines.length} replik`)),
          h('button', { class: 'btn small primary', type: 'button', onclick: () => showDialog(d) }, done ? 'Znovu' : 'Otevřít'),
        );
      }),
      h('button', { class: 'btn', type: 'button', onclick: showPractice }, 'Zpět'),
    );
  }

  // Replika protějšku má na výběr mužskou nahrávku (přípona -m); vaše role mluví vždy původním hlasem.
  function dialogFile(dialog, index) {
    const male = !dialog.lines[index].ty && progress.settings.partnerVoice === 'male';
    return `${dialog.id}-${index + 1}` + (male ? '-m' : '');
  }

  function voiceToggle(rerender) {
    const male = progress.settings.partnerVoice === 'male';
    return h('button', {
      class: 'btn', type: 'button', 'aria-pressed': String(male),
      onclick: () => { Engine.setPartnerVoice(progress, male ? 'female' : 'male'); save(); rerender(); },
    }, male ? '🧔 Protějšek v dialozích: mužský hlas' : '👩 Protějšek v dialozích: ženský hlas');
  }

  function dialogLine(dialog, index, { hideTy = false } = {}) {
    const line = dialog.lines[index];
    const mine = line.ty;
    return h('div', { class: 'bubble' + (mine ? ' mine' : '') },
      h('div', { class: 'muted' }, line.who),
      hideTy && mine ? null : h('div', { class: 'sentence' }, line.en),
      hideTy && mine ? null : h('div', { class: 'muted' }, line.cs),
      hideTy && mine ? null : (progress.settings.showPron ? h('div', { class: 'pron' }, line.pron) : null),
      hideTy && mine ? null : h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => playFile(dialogFile(dialog, index), line.en) }, '🔊 Přehrát')),
    );
  }

  function showDialog(dialog) {
    render(
      h('h1', {}, dialog.title),
      pronLegend(),
      dialog.lines.map((_, i) => dialogLine(dialog, i)),
      h('button', { class: 'btn primary', type: 'button', onclick: () => startDialog(dialog) }, 'Začít cvičení'),
      h('button', { class: 'btn', type: 'button', onclick: showDialogs }, 'Zpět na dialogy'),
    );
  }

  function startDialog(dialog) {
    const total = dialog.lines.filter((l) => l.ty).length;
    runDialog({
      kind: 'dialogs', dialog, index: 0, total, answered: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0,
      retry: () => startDialog(dialog),
    });
  }

  // Zobrazí rozhovor až po další repliku „Ty“; na ni se vybírá odpověď.
  function runDialog(state) {
    const { dialog } = state;
    let tyIndex = dialog.lines.findIndex((l, i) => i >= state.index && l.ty);
    const end = tyIndex === -1 ? dialog.lines.length : tyIndex;
    const bar = h('div', { class: 'progress' }, h('div', { style: `width:${Math.round((state.answered / state.total) * 100)}%` }));
    const history = [];
    for (let i = 0; i < end; i++) history.push(dialogLine(dialog, i));
    const feedback = h('div');

    if (tyIndex === -1) {
      render(bar, h('h2', {}, dialog.title), history,
        h('button', { class: 'btn primary', type: 'button', onclick: () => showPracticeResult(state) }, 'Dokončit'));
      return;
    }

    const line = dialog.lines[tyIndex];
    const body = h('div', {}, h('h2', {}, 'Co odpovíš?'));
    const buttons = Engine.dialogOptions(line).map((opt) => {
      const b = h('button', { class: 'btn', type: 'button' }, opt.text);
      b.addEventListener('click', () => {
        buttons.forEach((x) => { x.disabled = true; });
        b.classList.add(opt.correct ? 'good' : 'bad');
        if (!opt.correct) buttons.find((x) => x.textContent === line.en).classList.add('good');
        state.firstTry += 1;
        if (opt.correct) {
          state.firstTryCorrect += 1;
          Engine.addXp(progress, Engine.XP_PER_CORRECT);
          state.xpEarned += Engine.XP_PER_CORRECT;
        }
        state.answered += 1;
        save();
        feedback.replaceChildren(
          h('div', { class: 'feedback ' + (opt.correct ? 'good' : 'bad') },
            h('strong', {}, opt.correct ? 'Správně!' : 'Tady se hodí jiná odpověď.'),
            h('div', {}, `${line.en} – ${line.cs}`),
          ),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { state.index = tyIndex + 1; runDialog(state); } }, 'Pokračovat'),
        );
        feedback.querySelector('.btn.primary').focus();
        playFile(dialogFile(dialog, tyIndex), line.en);
      });
      return b;
    });
    body.append(...buttons);
    render(bar, h('h2', {}, dialog.title), history, body, feedback);
  }

  // ---------- skládání vět ----------

  function startSentences() {
    runSentence({ kind: 'sentences', queue: Engine.buildSentences(allWords), index: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0 });
  }

  function runSentence(state) {
    if (state.index >= state.queue.length) return showPracticeResult(state);
    const ex = state.queue[state.index];
    const word = wordsById[ex.itemId];
    const chosen = []; // pořadí vybraných karet (indexy do ex.tokens)
    let locked = false;
    const bar = h('div', { class: 'progress' }, h('div', { style: `width:${Math.round((state.index / state.queue.length) * 100)}%` }));
    const answerArea = h('div', { class: 'tiles answer', 'aria-label': 'Tvoje věta' });
    const bank = h('div', { class: 'tiles' });
    const feedback = h('div');
    const check = h('button', { class: 'btn primary', type: 'button', disabled: '' }, 'Zkontrolovat');

    function redraw() {
      answerArea.replaceChildren(...chosen.map((i) => {
        const b = h('button', { class: 'tile', type: 'button' }, ex.tokens[i]);
        b.addEventListener('click', () => { if (locked) return; chosen.splice(chosen.indexOf(i), 1); redraw(); });
        return b;
      }));
      bank.replaceChildren(...ex.tokens.map((t, i) => {
        const used = chosen.includes(i);
        const b = h('button', { class: 'tile' + (used ? ' ghost' : ''), type: 'button', tabindex: used ? '-1' : '0' }, t);
        b.addEventListener('click', () => { if (locked || used) return; chosen.push(i); redraw(); });
        return b;
      }));
      if (chosen.length === ex.tokens.length) check.removeAttribute('disabled');
      else check.setAttribute('disabled', '');
    }

    check.addEventListener('click', () => {
      if (locked) return;
      locked = true;
      check.setAttribute('disabled', '');
      const ok = Engine.checkSentence(chosen.map((i) => ex.tokens[i]), ex.answer);
      answerArea.querySelectorAll('.tile').forEach((t) => { t.classList.add(ok ? 'good' : 'bad'); t.setAttribute('disabled', ''); });
      if (!ex.retry) {
        state.firstTry += 1;
        if (ok) {
          state.firstTryCorrect += 1;
          Engine.addXp(progress, Engine.XP_PER_CORRECT);
          state.xpEarned += Engine.XP_PER_CORRECT;
        }
      }
      if (!ok) state.queue = Engine.requeue(state.queue, ex);
      save();
      feedback.replaceChildren(
        h('div', { class: 'feedback ' + (ok ? 'good' : 'bad') },
          h('strong', {}, ok ? 'Správně!' : 'Chyba, ale to se stane.'),
          h('div', { class: 'sentence' }, ex.answer),
          noteBox(word),
        ),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { state.index += 1; runSentence(state); } }, 'Pokračovat'),
      );
      feedback.querySelector('.btn.primary').focus();
      playFile(ex.audioAfter, ex.speakAfter);
    });

    render(
      bar,
      h('h2', {}, 'Seřaď slova do správné věty'),
      h('p', {}, ex.cs),
      answerArea,
      bank,
      check,
      feedback,
    );
    redraw();
  }

  // ---------- přiřazování dvojic ----------

  function startMatching() {
    const rounds = Engine.buildMatching(allWords);
    const total = rounds.reduce((sum, r) => sum + r.pairs.length, 0);
    runMatching({ kind: 'matching', rounds, round: 0, total, clean: 0 });
  }

  function runMatching(state) {
    if (state.round >= state.rounds.length) {
      state.firstTry = state.total;
      state.firstTryCorrect = state.clean;
      state.xpEarned = state.clean * Engine.XP_PER_CLEAN_PAIR;
      Engine.addXp(progress, state.xpEarned);
      return showPracticeResult(state);
    }
    const pairs = state.rounds[state.round].pairs;
    const flagged = new Set(); // slova, u kterých se chybovalo
    let left = null;
    let right = null;
    let busy = false;
    let remaining = pairs.length;
    const bar = h('div', { class: 'progress' }, h('div', { style: `width:${Math.round((state.round / state.rounds.length) * 100)}%` }));
    const feedback = h('div');

    const leftTiles = Engine.shuffle(pairs).map((p) => h('button', { class: 'tile', type: 'button', 'data-id': p.id }, p.en));
    const rightTiles = Engine.shuffle(pairs).map((p) => h('button', { class: 'tile', type: 'button', 'data-id': p.id }, p.cs));

    function pick(tile, side) {
      if (busy || tile.hasAttribute('disabled')) return;
      const current = side === 'left' ? left : right;
      if (current) current.classList.remove('selected');
      if (current === tile) {
        if (side === 'left') left = null; else right = null;
        return;
      }
      tile.classList.add('selected');
      if (side === 'left') {
        left = tile;
        playFile(tile.dataset.id, tile.textContent);
      } else {
        right = tile;
      }
      if (left && right) resolve();
    }

    function resolve() {
      const a = left;
      const b = right;
      left = null;
      right = null;
      if (a.dataset.id === b.dataset.id) {
        [a, b].forEach((t) => { t.classList.remove('selected'); t.classList.add('good'); t.setAttribute('disabled', ''); });
        if (!flagged.has(a.dataset.id)) state.clean += 1;
        remaining -= 1;
        if (remaining === 0) {
          feedback.replaceChildren(
            h('div', { class: 'feedback good' }, h('strong', {}, 'Všechno spojeno!')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => { state.round += 1; runMatching(state); } }, 'Pokračovat'),
          );
          feedback.querySelector('.btn.primary').focus();
        }
      } else {
        busy = true;
        flagged.add(a.dataset.id);
        flagged.add(b.dataset.id);
        [a, b].forEach((t) => t.classList.add('bad'));
        setTimeout(() => {
          [a, b].forEach((t) => t.classList.remove('bad', 'selected'));
          busy = false;
        }, 600);
      }
    }

    leftTiles.forEach((t) => t.addEventListener('click', () => pick(t, 'left')));
    rightTiles.forEach((t) => t.addEventListener('click', () => pick(t, 'right')));

    render(
      bar,
      h('h2', {}, 'Spoj dvojice'),
      h('p', { class: 'muted' }, `Kolo ${state.round + 1} z ${state.rounds.length}. Kliknutím na anglické slovo ho uslyšíš.`),
      h('div', { class: 'match' }, h('div', { class: 'col' }, leftTiles), h('div', { class: 'col' }, rightTiles)),
      feedback,
    );
  }

  function showPracticeResult(state) {
    const accuracy = state.firstTry ? state.firstTryCorrect / state.firstTry : 0;
    Engine.completePractice(progress, state.kind, accuracy);
    if (state.dialog) Engine.completeDialog(progress, state.dialog.id, accuracy);
    save();
    const { gained, challengeDone } = settleProgress();
    celebrateResult(gained, challengeDone, false);
    render(
      h('div', { class: 'center' },
        h('h1', {}, PRACTICE[state.kind].title + ': hotovo!'),
        h('div', { class: 'result-score' }, Math.round(accuracy * 100) + ' %'),
        owl(Engine.owlSay('practiceDone', { accuracy })),
        h('p', {}, `Správně napoprvé: ${state.firstTryCorrect} z ${state.firstTry}`),
        h('p', {}, `Získané body: ${state.xpEarned}`),
        h('p', { class: 'muted' }, accuracy >= 0.8 ? 'Skvělá práce!' : 'Zkus to klidně znovu, pořadí se pokaždé zamíchá.'),
        goalLine(),
      ),
      badgeAwardCard(gained, challengeDone),
      h('button', { class: 'btn primary', type: 'button', onclick: () => (state.retry ? state.retry() : state.kind === 'sounds' ? startSoundsQuiz() : startPractice(state.kind)) }, 'Zkusit znovu'),
      h('button', { class: 'btn', type: 'button', onclick: showPractice }, 'Na přehled'),
    );
  }

  function startReview(due) {
    const exercises = Engine.buildReview(due, allWords);
    runExercise({
      lesson: null,
      review: true,
      queue: exercises,
      index: 0,
      total: exercises.length,
      firstTry: 0,
      firstTryCorrect: 0,
      xpEarned: 0,
    });
  }

  function runExercise(state) {
    if (state.index >= state.queue.length) return showResult(state);
    const exercise = state.queue[state.index];
    const word = wordsById[exercise.wordId];
    const bar = h('div', { class: 'progress' }, h('div', { style: `width:${Math.round((state.index / state.queue.length) * 100)}%` }));
    const feedback = h('div');
    const body = h('div', {});

    function finish(result) {
      // result: 'correct' | 'typo' | 'wrong'
      const ok = result !== 'wrong';
      Engine.recordAnswer(progress, word.id, ok);
      if (!exercise.retry) {
        state.firstTry += 1;
        if (ok) {
          state.firstTryCorrect += 1;
          Engine.addXp(progress, Engine.XP_PER_CORRECT);
          state.xpEarned += Engine.XP_PER_CORRECT;
        }
      }
      if (!ok) state.queue = Engine.requeue(state.queue, exercise);
      save();

      const message = result === 'correct' ? 'Správně!'
        : result === 'typo' ? 'Skoro! Pozor na překlep.'
        : 'Chyba, ale to se stane.';
      feedback.replaceChildren(
        h('div', { class: 'feedback ' + (ok ? 'good' : 'bad') },
          h('strong', {}, message),
          h('div', {}, `${word.en} = ${word.cs}`),
          pronLine(word),
          ok && result === 'correct' ? null : noteBox(word),
        ),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { state.index += 1; runExercise(state); } }, 'Pokračovat'),
      );
      feedback.querySelector('.btn.primary').focus();
    }

    if (exercise.type === 'listenType') {
      const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Co slyšíš?' });
      const check = h('button', { class: 'btn primary', type: 'button' }, 'Zkontrolovat');
      const submit = () => {
        if (!input.value.trim()) return;
        input.disabled = true;
        check.disabled = true;
        finish(Engine.checkTyped(input.value, word.en));
      };
      check.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      body.append(
        h('h2', {}, 'Napiš, co slyšíš'),
        soundButtons(word, false),
        input,
        check,
      );
      setTimeout(() => input.focus(), 0);
    } else {
      const title = exercise.type === 'translate' ? 'Co znamená toto slovo?' : 'Poslechni si a vyber význam';
      body.append(h('h2', {}, title));
      if (exercise.type === 'translate') body.append(h('div', { class: 'big-word' }, word.en));
      body.append(soundButtons(word, false));
      const buttons = exercise.options.map((opt) => {
        const b = h('button', { class: 'btn', type: 'button' }, opt.text);
        b.addEventListener('click', () => {
          const correct = opt.id === word.id;
          buttons.forEach((x) => { x.disabled = true; });
          b.classList.add(correct ? 'good' : 'bad');
          if (!correct) buttons[exercise.options.findIndex((o) => o.id === word.id)].classList.add('good');
          finish(correct ? 'correct' : 'wrong');
        });
        return b;
      });
      body.append(...buttons);
    }

    render(bar, body, feedback);
    if (exercise.type !== 'translate') play(word);
  }

  // ---------- výsledek ----------

  function showReviewResult(state) {
    Engine.updateStreak(progress);
    save();
    const { gained, challengeDone } = settleProgress();
    celebrateResult(gained, challengeDone, false);
    const left = Engine.dueWords(progress, allWords).length;
    render(
      h('div', { class: 'center' },
        h('h1', {}, 'Opakování hotové!'),
        owl(Engine.owlSay('practiceDone', { accuracy: state.firstTry ? state.firstTryCorrect / state.firstTry : 0 })),
        h('p', {}, `Správně napoprvé: ${state.firstTryCorrect} z ${state.firstTry}`),
        h('p', {}, `Získané body: ${state.xpEarned}`),
        goalLine(),
        h('p', { class: 'muted' }, left ? `Ještě zbývá ${left} ${wordForm(left)} k zopakování.` : 'Na dnes máš všechno zopakované.'),
      ),
      badgeAwardCard(gained, challengeDone),
      left ? h('button', { class: 'btn primary', type: 'button', onclick: () => startReview(Engine.dueWords(progress, allWords)) }, 'Pokračovat v opakování') : null,
      h('button', { class: 'btn', type: 'button', onclick: showHome }, 'Na přehled lekcí'),
    );
  }

  function showResult(state) {
    if (state.review) return showReviewResult(state);
    const accuracy = state.firstTry ? state.firstTryCorrect / state.firstTry : 0;
    const bonusBefore = progress.xp;
    Engine.completeLesson(progress, state.lesson.id, accuracy);
    save();
    const { gained, challengeDone } = settleProgress();
    celebrateResult(gained, challengeDone, accuracy === 1);
    lastCompletedLessonId = state.lesson.id;
    const bonus = progress.xp - bonusBefore;
    const index = lessons.indexOf(state.lesson);
    const next = lessons[index + 1];
    render(
      h('div', { class: 'center' },
        h('h1', {}, 'Lekce hotová!'),
        h('div', { class: 'result-score' }, Math.round(accuracy * 100) + ' %'),
        owl(Engine.owlSay('lessonDone', { accuracy })),
        h('p', {}, `Správně napoprvé: ${state.firstTryCorrect} z ${state.firstTry}`),
        h('p', {}, `Získané body: ${state.xpEarned + bonus}${bonus ? ` (z toho ${bonus} bonus za první dokončení)` : ''}`),
        h('p', { class: 'muted' }, accuracy >= 0.8 ? 'Skvělá práce!' : 'Slova, která ti nešla, se ti ještě vrátí. Zkus lekci klidně zopakovat.'),
        goalLine(),
      ),
      badgeAwardCard(gained, challengeDone),
      next ? h('button', { class: 'btn primary', type: 'button', onclick: () => showIntro(next) }, 'Další lekce') : null,
      h('button', { class: 'btn', type: 'button', onclick: () => startLesson(state.lesson) }, 'Zopakovat lekci'),
      h('button', { class: 'btn', type: 'button', onclick: showHome }, 'Na přehled lekcí'),
    );
  }

  // Offline režim (service worker funguje jen přes http/https, ne z file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  document.getElementById('home').addEventListener('click', showHome);
  backButton.addEventListener('click', () => showTab(lastTab));
  // Po otočení displeje nebo změně velikosti okna se cesta přepočítá, pokud se změnila její šířka.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const rendered = app.querySelector('.path');
      if (lastTab !== 'path' || !rendered || tabBar.hidden) return; // jen na záložce Cesta
      if (pathWidth() !== parseFloat(rendered.style.width)) showTab('path', { keepScroll: true });
    }, 150);
  });
  tabBar.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  updateStats();
  applyTheme();
  settleProgress(); // tiché doplnění výzvy a odznaků při startu (bez karty), aby uživatelé s existujícím postupem nedostali hromadu karet
  showHome();
})();
