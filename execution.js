/* EvoluPersonal execution. Reference review: OpenGym 8fb98b1,
   history.js, per-set.js, finish-workout.js and cardio-reps.test.js.
   Independent implementation for EvoluPersonal's flat session records. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  root.EPExecution = api;
  const itemFor = (id, index) => {
    const record = db.drafts[id]?.records[index];
    return { record, item: db.workouts.find(w => w.id === id)?.items[record?.item] };
  };
  function commit(record, change) {
    const before = structuredClone(record);
    change();
    if (save()) return true;
    for (const key of Object.keys(record)) delete record[key];
    Object.assign(record, before);
    render();
    return false;
  }
  root.epExecutionNumber = function (id, index, field, value, block) {
    const { record, item } = itemFor(id, index);
    if (!record || record.done) return;
    const limits = { durationSeconds: 86400, distanceKm: 1000, load: 2000, reps: 500 };
    if (!(field in limits)) return;
    const n = value === '' ? null : Number(String(value).replace(',', '.'));
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > limits[field] || field === 'reps' && !Number.isInteger(n))) {
      toast('Informe um valor válido dentro do limite do campo.'); render(); return;
    }
    commit(record, () => {
      record.executionMode = item.executionMode || 'reps';
      if (block !== undefined) {
        if (!Number.isInteger(block) || block < 0 || block >= api.blockCount(record)) return;
        record.blocks ||= Array.from({ length: api.blockCount(record) }, () => ({ load: null, reps: null }));
        record.blocks[block] ||= { load: null, reps: null };
        record.blocks[block][field] = n;
      } else record[field] = n;
      if (record.executionMode !== 'reps') record.reps = api.summary(record);
    });
  };
  root.epWorkTimer = function (id, index) {
    const { record, item } = itemFor(id, index);
    if (!record || record.done || !['timed', 'cardio'].includes(item?.executionMode)) return;
    commit(record, () => {
      record.executionMode = item.executionMode;
      if (record.workStartedAt) {
        record.durationSeconds = api.elapsed(record, Date.now());
        delete record.workStartedAt;
        record.reps = api.summary(record);
      } else record.workStartedAt = Date.now();
    });
    render();
  };
  const previousStart = root.startStudentWorkout;
  root.startStudentWorkout = function (id) {
    previousStart(id);
    const workout = db.workouts.find(w => w.id === id);
    const draft = db.drafts[id];
    if (!workout || !draft) return;
    const before = structuredClone(draft);
    draft.records.forEach(record => {
      record.executionMode ??= workout.items[record.item].executionMode || 'reps';
    });
    if (!save()) db.drafts[id] = before;
    render();
  };
  root.updateStudentRecord = function (id, index, field, value) {
    const record = db.drafts[id]?.records[index];
    if (!record || record.done) { render(); return; }
    if (!['load', 'reps', 'left', 'right'].includes(field)) return;
    const text = String(value ?? '').trim().replace(',', '.');
    const number = text === '' ? null : Number(text);
    const max = field === 'load' ? 2000 : 500;
    if (number !== null && (!Number.isFinite(number) || number < 0 || number > max || field !== 'load' && !Number.isInteger(number))) {
      toast(field === 'load' ? 'Informe uma carga de 0 a 2000.' : 'Informe repetições inteiras de 0 a 500.');
      render(); return;
    }
    commit(record, () => {
      if (field === 'load') { record.load = number; record.manualLoad = true; }
      else {
        record[field] = number === null ? '' : String(number);
        if (field === 'left' || field === 'right') record.reps = 'E: ' + (record.left || '—') + ' · D: ' + (record.right || '—');
      }
    });
  };
  const previousToggle = root.toggleStudentSet;
  root.toggleStudentSet = function (id, index, checked) {
    const { record, item } = itemFor(id, index);
    if (!record || !item) return;
    if (checked) {
      const message = api.completionError(record, item);
      if (message) { toast(message); render(); return; }
    }
    previousToggle(id, index, checked);
  };
  const previousValid = root.validDB;
  root.validDB = function (data) {
    if (!previousValid(data)) return false;
    return [...data.sessions, ...Object.values(data.drafts)].every(session =>
      session.records.every(api.validRecord));
  };
  const previousShow = root.showSession;
  root.showSession = function (id) {
    previousShow(id);
    const session = db.sessions.find(s => s.id === id);
    if (!session) return;
    const body = document.getElementById('modalBody');
    if (body) body.insertAdjacentHTML('beforeend', session.records
      .filter(r => r.executionMode && r.executionMode !== 'reps' || r.blocks?.length)
      .map(r => '<p><strong>' + esc(r.name) + ' · série ' + r.set + '</strong><br>' + esc(api.summary(r)) + '</p>').join(''));
  };
  root.epExecutionInputs = function (id, index, record, item) {
    if (!['timed', 'cardio'].includes(item.executionMode)) return null;
    const field = (key, label, max, step) => '<label>' + label + '<input type="number" min="0" max="' + max + '" step="' + step + '" ' +
      (record.done || record.workStartedAt ? 'disabled ' : '') + 'value="' + esc(record[key] ?? '') + '" onchange="epExecutionNumber(\'' + esc(id) + '\',' + index + ',\'' + key + '\',this.value)"></label>';
    const seconds = api.elapsed(record, Date.now());
    return '<div>' + field('durationSeconds', 'Duração realizada (segundos)', 86400, 1) +
      (item.executionMode === 'cardio' ? field('distanceKm', 'Distância realizada (km)', 1000, 0.01) : '') +
      '<button type="button" ' + (record.done ? 'disabled ' : '') + 'onclick="epWorkTimer(\'' + esc(id) + '\',' + index + ')">' + (record.workStartedAt ? 'Parar e registrar' : 'Iniciar cronômetro') + '</button> ' +
      '<output data-ep-work-start="' + (record.workStartedAt || 0) + '" data-ep-work-base="' + (record.durationSeconds || 0) + '">' + seconds + ' s</output>' +
      (record.distanceKm > 0 && seconds > 0 ? '<small> · ' + (record.distanceKm * 3600 / seconds).toFixed(1) + ' km/h</small>' : '') + '</div>';
  };
  root.epTechniqueInputs = function (id, index, record) {
    const count = api.blockCount(record);
    if (!count) return '';
    return '<div class="ep-tech-note"><strong>' + (record.type === 'drop' ? 'Quedas de carga' : 'Mini-séries após pausa') + '</strong>' +
      Array.from({ length: count }, (_, n) => {
        const block = record.blocks?.[n] || {};
        return '<div class="row wrap"><span>Bloco ' + (n + 1) + '</span>' +
          ['load', 'reps'].map(field => '<label>' + (field === 'load' ? 'Carga' : 'Repetições') + '<input type="number" min="0" max="' + (field === 'load' ? 2000 : 500) +
            '" step="' + (field === 'load' ? 'any' : 1) + '" value="' + esc(block[field] ?? '') + '" ' + (record.done ? 'disabled ' : '') +
            'onchange="epExecutionNumber(\'' + esc(id) + '\',' + index + ',\'' + field + '\',this.value,' + n + ')"></label>').join('') +
          (record.type === 'restpause' ? '<button type="button" onclick="startTimer(' + (record.miniRest || 20) + ')">Pausa de ' + (record.miniRest || 20) + ' s</button>' : '') + '</div>';
      }).join('') + '</div>';
  };
  setInterval(() => {
    document.querySelectorAll('[data-ep-work-start]').forEach(output => {
      const start = Number(output.dataset.epWorkStart);
      if (start) output.textContent = Math.min(86400, Number(output.dataset.epWorkBase) + Math.max(0, Math.floor((Date.now() - start) / 1000))) + ' s';
    });
  }, 1000);
  render();
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const modes = ['reps', 'timed', 'cardio'];
  const bounded = (n, max) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  function elapsed(record, now) {
    return Math.min(86400, (record.durationSeconds || 0) + (record.workStartedAt ? Math.max(0, Math.floor((now - record.workStartedAt) / 1000)) : 0));
  }
  function blockCount(record) {
    if (record.executionMode && record.executionMode !== 'reps') return 0;
    return record.type === 'drop' ? record.drops || 2 : record.type === 'restpause' ? record.miniSets || 2 : 0;
  }
  function validRecord(record) {
    return (record.executionMode === undefined || modes.includes(record.executionMode)) &&
      (record.durationSeconds == null || bounded(record.durationSeconds, 86400)) &&
      (record.distanceKm == null || bounded(record.distanceKm, 1000)) &&
      (record.workStartedAt === undefined || bounded(record.workStartedAt, 8640000000000000)) &&
      (record.blocks === undefined || Array.isArray(record.blocks) && record.blocks.length <= 5 && record.blocks.every(b =>
        b && (b.load === null || bounded(b.load, 2000)) && (b.reps === null || bounded(b.reps, 500) && Number.isInteger(b.reps))));
  }
  function completionError(record, item) {
    if (record.workStartedAt) return 'Pare o cronômetro para registrar o tempo antes de concluir.';
    const mode = record.executionMode || item.executionMode || 'reps';
    if (mode !== 'reps' && !(record.durationSeconds > 0)) return 'Registre a duração realizada em segundos.';
    if (mode === 'reps') {
      if (item.sideMode === 'separate') {
        if (![record.left, record.right].every(value => /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 500)) return 'Registre repetições inteiras de 1 a 500 para os dois lados.';
      } else if (!/^\d+$/.test(String(record.reps)) || Number(record.reps) < 1 || Number(record.reps) > 500) return 'Registre as repetições realizadas de 1 a 500.';
    }
    if (blockCount(record)) {
      if (!(/^\d+$/.test(String(record.reps)) && Number(record.reps) > 0) && !(Number(record.left) > 0 && Number(record.right) > 0)) return 'Registre as repetições da série principal.';
      if (record.blocks?.length !== blockCount(record) || record.blocks.some(b => !b || !bounded(b.load, 2000) || !Number.isInteger(b.reps) || b.reps < 1 || b.reps > 500)) return 'Preencha a carga e as repetições de cada bloco.';
    }
    return '';
  }
  function summary(record) {
    if (record.executionMode === 'cardio') return (record.durationSeconds || 0) + ' s · ' + (record.distanceKm || 0) + ' km';
    if (record.executionMode === 'timed') return (record.durationSeconds || 0) + ' s';
    return record.reps + ' rep.' + (record.blocks || []).map(b => ' + ' + b.load + ' × ' + b.reps).join('');
  }
  return { elapsed, blockCount, validRecord, completionError, summary };
});
