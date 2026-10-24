// Rozhraní aplikace. Veškerý obsah se do stránky vkládá jako text (textContent), nikdy jako HTML.
(function () {
  const lessons = window.CONTENT.lessons;
  const wordsById = {};
  lessons.forEach((l) => l.words.forEach((w) => { wordsById[w.id] = w; }));
  const allWords = Object.values(wordsById);

  const PRACTICE = {
    mistakes: { title: 'Typické chyby Čechů', icon: '⚠️', hint: 'Vyber správnou větu', items: window.EXTRAS.mistakes },
    falseFriends: { title: 'Falešní přátelé', icon: '🎭', hint: 'Slova, která se jen tváří česky', items: window.EXTRAS.falseFriends },
    pairs: { title: 'Minimální páry', icon: '👂', hint: 'Poslech: ship nebo sheep?', items: window.EXTRAS.pairs },
    sounds: { title: 'Výslovnost: th a w/v', icon: '👅', hint: 'Návod, slova, jazykolamy a poslech', start: () => showSounds() },
    dialogs: { title: 'Dialogy ze situací', icon: '💬', hint: 'Restaurace, letiště, lékař… poslech a odpovědi', start: () => showDialogs() },
    sentences: { title: 'Skládání vět', icon: '🧩', hint: 'Seřaď slova do správné věty', start: () => startSentences() },
    matching: { title: 'Přiřazování dvojic', icon: '🔗', hint: 'Spoj anglické slovo s českým', start: () => startMatching() },
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
  let progress = Engine.loadProgress(window.localStorage);
  let currentAudio = null;
  let renderingHome = false;

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
    app.replaceChildren(...nodes.flat());
    backButton.hidden = renderingHome; // tlačítko Domů se na úvodní obrazovce nezobrazuje
    renderingHome = false;
    window.scrollTo(0, 0);
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
      onclick: () => { Engine.setDailyGoal(progress, value); save(); showHome(); },
    }, String(value)));
    return h('div', { class: 'card' },
      h('strong', {}, g.done ? '🎯 Denní cíl splněn!' : '🎯 Denní cíl'),
      h('div', { class: 'progress' }, h('div', { style: `width:${Math.round(g.ratio * 100)}%` })),
      h('div', { class: 'muted' }, `Dnes ${g.xp} z ${g.goal} bodů`),
      h('div', { class: 'muted' }, 'Cíl (body za den):'),
      h('div', { class: 'row' }, chips),
    );
  }

  // ---------- domovská obrazovka ----------

  function showHome() {
    renderingHome = true;
    const list = lessons.map((lesson, index) => {
      const unlocked = Engine.isLessonUnlocked(progress, lessons, index);
      const state = progress.lessons[lesson.id];
      const badge = state && state.done ? '✅' : unlocked ? '▶️' : '🔒';
      const sub = state && state.done
        ? `Hotovo, nejlepší výsledek ${Math.round(state.best * 100)} %`
        : unlocked ? `${lesson.words.length} slov` : 'Zamčeno – dokonči předchozí lekci';
      const card = h('div', { class: 'card lesson' + (unlocked ? '' : ' locked') },
        h('span', { class: 'badge' }, badge),
        h('div', { class: 'info' }, h('strong', {}, `${index + 1}. ${lesson.title}`), h('div', { class: 'muted' }, sub)),
        unlocked ? h('button', { class: 'btn small primary', type: 'button', onclick: () => showIntro(lesson) }, state && state.done ? 'Znovu' : 'Začít') : null,
      );
      return card;
    });

    const due = Engine.dueWords(progress, allWords);
    const reviewCard = due.length
      ? h('div', { class: 'card lesson' },
        h('span', { class: 'badge' }, '🔁'),
        h('div', { class: 'info' }, h('strong', {}, 'Opakování'), h('div', { class: 'muted' }, `K zopakování: ${due.length} ${wordForm(due.length)}`)),
        h('button', { class: 'btn small primary', type: 'button', onclick: () => startReview(due) }, 'Zopakovat'))
      : null;

    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: '', onchange: importFile });
    render(
      h('h1', {}, 'Učíme se anglicky'),
      h('p', { class: 'muted' }, `Znáš už ${Engine.knownWords(progress)} slov z ${Object.keys(wordsById).length}.`),
      goalCard(),
      reviewCard,
      list,
      h('h2', {}, 'Procvičování'),
      Object.keys(PRACTICE).map(practiceCard),
      statsSection(),
      h('h2', {}, 'Nastavení'),
      h('button', {
        class: 'btn', type: 'button', 'aria-pressed': String(progress.settings.showPron),
        onclick: () => { Engine.setShowPron(progress, !progress.settings.showPron); save(); showHome(); },
      }, progress.settings.showPron ? '✅ Přepis výslovnosti: zapnuto' : '⬜ Přepis výslovnosti: vypnuto'),
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
    );
  }

  function practiceCard(kind) {
    const def = PRACTICE[kind];
    const done = progress.practice[kind];
    return h('div', { class: 'card lesson' },
      h('span', { class: 'badge' }, def.icon),
      h('div', { class: 'info' }, h('strong', {}, def.title),
        h('div', { class: 'muted' }, done ? `${def.hint} · nejlepší výsledek ${Math.round(done.best * 100)} %` : def.hint)),
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
    save();
    showHome();
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
        save();
        showHome();
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
        h('button', { class: 'btn small', type: 'button', onclick: () => playFile(ex.audioNow, ex.speakNow) }, '🔊 Přehrát')));
    }

    function finish(ok) {
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
          h('div', {}, ex.explanation),
          ex.afterText ? h('div', { class: 'sentence' }, ex.afterText) : null,
        ),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { state.index += 1; runPractice(state); } }, 'Pokračovat'),
      );
      feedback.querySelector('.btn.primary').focus();
      if (ex.audioAfter) playFile(ex.audioAfter, ex.speakAfter);
    }

    const buttons = ex.options.map((opt) => {
      const b = h('button', { class: 'btn', type: 'button' }, opt.text);
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
      h('button', { class: 'btn', type: 'button', onclick: showHome }, 'Zpět'),
    );
  }

  function startSoundsQuiz() {
    const exercises = Engine.buildPractice('sounds', soundPairs);
    runPractice({ kind: 'sounds', queue: exercises, index: 0, firstTry: 0, firstTryCorrect: 0, xpEarned: 0 });
  }

  // ---------- dialogy ze situací ----------

  const dialogs = window.EXTRAS.dialogs;

  function showDialogs() {
    const done = progress.practice.dialogs;
    render(
      h('h1', {}, 'Dialogy ze situací'),
      h('p', { class: 'muted' }, 'Nejdřív si dialog přečti a poslechni, pak odpovídej za svou roli.'),
      done ? h('p', { class: 'muted' }, `Nejlepší výsledek cvičení: ${Math.round(done.best * 100)} %`) : null,
      dialogs.map((d) => h('div', { class: 'card lesson' },
        h('div', { class: 'info' }, h('strong', {}, d.title),
          h('div', { class: 'muted' }, `${d.lines.length} replik`)),
        h('button', { class: 'btn small primary', type: 'button', onclick: () => showDialog(d) }, 'Otevřít'),
      )),
      h('button', { class: 'btn', type: 'button', onclick: showHome }, 'Zpět'),
    );
  }

  function dialogFile(dialog, index) {
    return `${dialog.id}-${index + 1}`;
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
    save();
    render(
      h('div', { class: 'center' },
        h('h1', {}, PRACTICE[state.kind].title + ': hotovo!'),
        h('div', { class: 'result-score' }, Math.round(accuracy * 100) + ' %'),
        h('p', {}, `Správně napoprvé: ${state.firstTryCorrect} z ${state.firstTry}`),
        h('p', {}, `Získané body: ${state.xpEarned}`),
        h('p', { class: 'muted' }, accuracy >= 0.8 ? 'Skvělá práce!' : 'Zkus to klidně znovu, pořadí se pokaždé zamíchá.'),
        goalLine(),
      ),
      h('button', { class: 'btn primary', type: 'button', onclick: () => (state.retry ? state.retry() : state.kind === 'sounds' ? startSoundsQuiz() : startPractice(state.kind)) }, 'Zkusit znovu'),
      h('button', { class: 'btn', type: 'button', onclick: showHome }, 'Na přehled'),
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
    const left = Engine.dueWords(progress, allWords).length;
    render(
      h('div', { class: 'center' },
        h('h1', {}, 'Opakování hotové!'),
        h('p', {}, `Správně napoprvé: ${state.firstTryCorrect} z ${state.firstTry}`),
        h('p', {}, `Získané body: ${state.xpEarned}`),
        goalLine(),
        h('p', { class: 'muted' }, left ? `Ještě zbývá ${left} ${wordForm(left)} k zopakování.` : 'Na dnes máš všechno zopakované.'),
      ),
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
    const bonus = progress.xp - bonusBefore;
    const index = lessons.indexOf(state.lesson);
    const next = lessons[index + 1];
    render(
      h('div', { class: 'center' },
        h('h1', {}, 'Lekce hotová!'),
        h('div', { class: 'result-score' }, Math.round(accuracy * 100) + ' %'),
        h('p', {}, `Správně napoprvé: ${state.firstTryCorrect} z ${state.firstTry}`),
        h('p', {}, `Získané body: ${state.xpEarned + bonus}${bonus ? ` (z toho ${bonus} bonus za první dokončení)` : ''}`),
        h('p', { class: 'muted' }, accuracy >= 0.8 ? 'Skvělá práce!' : 'Slova, která ti nešla, se ti ještě vrátí. Zkus lekci klidně zopakovat.'),
        goalLine(),
      ),
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
  backButton.addEventListener('click', showHome);
  updateStats();
  showHome();
})();
