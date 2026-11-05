/* EvoluPersonal. OpenGym reference review 8fb98b1: session-edit.js,
   workout-date.js and per-set.js. Independent flat-record implementation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  root.EPHistory = api;
  let editing = null, metric = 'load', unit = 'kg total';
  const fmt = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  function localTime(value) {
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  root.epOpenHistory = function () {
    const rows = db.sessions.filter(s => insightStudent === 'all' || s.student === insightStudent)
      .slice().sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    openModal('Histórico de sessões', rows.length ? rows.map(s => '<div class="listrow"><div><strong>' + esc(s.title) + '</strong><p>' +
      esc(student(s.student)?.name || 'Aluno') + ' · ' + date(s.date) + '</p></div><button onclick="showSession(\'' + esc(s.id) + '\')">Ver sessão</button></div>').join('') :
      '<p>Nenhuma sessão registrada para este aluno.</p>', true);
  };
  const previousShow = root.showSession;
  root.showSession = function (id) {
    previousShow(id);
    if (db.sessions.some(s => s.id === id)) document.getElementById('modalBody')?.insertAdjacentHTML('beforeend',
      '<div class="modalfoot"><button class="primary" onclick="epEditSession(\'' + esc(id) + '\')">Corrigir sessão</button></div>');
  };
  root.epEditSession = function (id) {
    if (typeof activeStudentWorkout !== 'undefined' && activeStudentWorkout) return toast('Finalize ou salve e saia do treino antes de corrigir o histórico.');
    const original = db.sessions.find(s => s.id === id);
    if (!original) return toast('Esta sessão não está mais disponível.');
    editing = { original: structuredClone(original), dateInput: localTime(original.date) };
    const input = (name, label, value, type = 'text', extra = '') => '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + esc(value ?? '') + '" ' + extra + '></label>';
    const numeric = (name, label, value, max, integer = false) => input(name, label, value, 'number', 'min="0" max="' + max + '" step="' + (integer ? 1 : 'any') + '"');
    const rows = original.records.map((r, i) => {
      const mode = r.executionMode || 'reps';
      return '<fieldset class="card section"><legend>' + esc(r.name) + ' · série ' + r.set + '</legend><div class="fields">' +
        numeric('load' + i, 'Carga (' + (r.unit || 'kg total') + ')', r.load, 2000) +
        (mode === 'reps' ? input('reps' + i, 'Repetições registradas', r.reps, 'text', 'maxlength="40" required') :
          numeric('duration' + i, 'Duração (segundos)', r.durationSeconds, 86400, true)) +
        (mode === 'cardio' ? numeric('distance' + i, 'Distância (km)', r.distanceKm, 1000) : '') +
        (r.left !== undefined && (r.left || r.right) ? numeric('left' + i, 'Repetições à esquerda', r.left, 500, true) + numeric('right' + i, 'Repetições à direita', r.right, 500, true) : '') +
        numeric('rir' + i, 'RIR', r.rir, 10, true) + '</div>' +
        (r.blocks || []).map((b, n) => '<div class="fields"><strong>Bloco ' + (n + 1) + '</strong>' +
          numeric('blockload' + i + '_' + n, 'Carga', b.load, 2000) + numeric('blockreps' + i + '_' + n, 'Repetições', b.reps, 500, true) + '</div>').join('') +
        '<label><input type="checkbox" name="remove' + i + '"> Remover esta série do registro</label></fieldset>';
    }).join('');
    openModal('Corrigir sessão', '<form id="epHistoryEdit"><div class="fields">' +
      input('title', 'Nome da sessão', original.title, 'text', 'maxlength="100" required') +
      input('date', 'Data e hora', editing.dateInput, 'datetime-local', 'required') +
      '<label>Esforço<select name="effort">' + [...new Set([original.effort, 'Leve', 'Moderado', 'Intenso', 'Muito intenso'])].map(x => '<option>' + esc(x) + '</option>').join('') + '</select></label></div>' +
      '<label>Observações<textarea name="feedback" maxlength="1500">' + esc(original.feedback) + '</textarea></label>' + rows +
      '<div class="modalfoot"><button type="button" onclick="showSession(\'' + esc(id) + '\')">Cancelar</button><button class="primary">Salvar correção</button></div></form>', true);
    document.getElementById('epHistoryEdit').onsubmit = event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      try {
        const candidate = api.editCandidate(editing.original, values, editing.dateInput);
        // Merge into the latest persisted database so another tab's unrelated changes survive.
        const raw = localStorage.getItem(KEY);
        const latest = raw ? migrateDB(JSON.parse(raw)) : structuredClone(db);
        if (!validDB(latest)) throw Error('A base salva precisa ser revisada antes da correção.');
        const next = api.replaceSession(latest, editing.original, candidate);
        if (!validDB(next)) throw Error('Revise os valores da sessão. A correção não passou na validação.');
        const previous = db;
        db = next;
        if (!save()) { db = previous; return; }
        editing = null;
        closeModal(); render(); toast('Sessão corrigida. Os indicadores foram recalculados.');
      } catch (error) { toast(error.message || 'Não foi possível salvar a correção.'); }
    };
  };
  root.epHistoryMetric = function (value) { metric = value; render(); };
  root.epHistoryUnit = function (value) { unit = value; render(); };
  root.epHistoryChart = function (data) {
    const toolbar = '<button onclick="epOpenHistory()">Histórico completo</button>';
    if (insightStudent === 'all') return '<section class="card section"><div class="between"><h2>Evolução por exercício</h2>' + toolbar + '</div><p>Selecione um aluno para acompanhar seus registros ao longo do tempo.</p></section>';
    const rows = data.rows.filter(r => r.exercise === insightExercise);
    const metrics = { load: 'Carga', volume: 'Volume', estimated1RM: '1RM estimada', reps: 'Repetições', durationSeconds: 'Duração (s)', distanceKm: 'Distância (km)' };
    const choices = data.exercises.map(e => '<option value="' + esc(e.id) + '" ' + (e.id === insightExercise ? 'selected' : '') + '>' + esc(e.name) + '</option>').join('');
    const units = [...new Set(rows.map(r => r.unit || 'kg total'))];
    if (!units.includes(unit)) unit = units[0] || 'kg total';
    const points = api.points(rows.filter(r => (r.unit || 'kg total') === unit), metric);
    const label = metrics[metric];
    const select = '<div class="fields"><label>Exercício<select onchange="insightExercise=this.value;render()">' + choices + '</select></label><label>Indicador<select onchange="epHistoryMetric(this.value)">' +
      Object.entries(metrics).map(([key, text]) => '<option value="' + key + '" ' + (key === metric ? 'selected' : '') + '>' + text + '</option>').join('') +
      '</select></label><label>Unidade da carga<select onchange="epHistoryUnit(this.value)">' + units.map(u => '<option ' + (unit === u ? 'selected' : '') + '>' + esc(u) + '</option>').join('') + '</select></label></div>';
    const max = Math.max(1, ...points.map(p => p.value)), min = Math.min(0, ...points.map(p => p.value));
    const xy = points.map((p, i) => ({ x: points.length === 1 ? 300 : 35 + i * 530 / (points.length - 1), y: 160 - (p.value - min) / (max - min) * 130, ...p }));
    const graph = points.length ? '<svg viewBox="0 0 600 190" role="img" aria-label="' + esc(label) + ' por sessão" style="width:100%;max-height:260px"><path d="M35 20V160H565" fill="none" stroke="currentColor" opacity=".3"/><polyline points="' +
      xy.map(p => p.x + ',' + p.y).join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="3"/>' + xy.map(p => '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" fill="var(--accent)"><title>' + esc(date(p.date)) + ' · ' + fmt(p.value) + '</title></circle>').join('') + '</svg>' +
      '<div style="max-height:240px;overflow:auto"><table class="insight-table"><thead><tr><th>Data</th><th>' + esc(label) + '</th><th>Sessão</th></tr></thead><tbody>' +
      points.map(p => '<tr><td>' + esc(date(p.date)) + '</td><td>' + fmt(p.value) + '</td><td><button onclick="showSession(\'' + esc(p.session) + '\')">Ver</button></td></tr>').join('') + '</tbody></table></div>' :
      '<p>Nenhum registro válido para este indicador. Para tempo ou cardio, selecione duração ou distância.</p>';
    return '<section class="card section"><div class="between"><h2>Evolução por exercício</h2>' + toolbar + '</div>' + select + graph +
      '<p class="muted">Volume, duração e distância somam os registros da sessão. Carga, repetições e 1RM mostram o maior valor por sessão. Cada unidade de carga é exibida separadamente.</p></section>';
  };
  render();
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  const finite = (value, max, integer = false) => Number.isFinite(value) && value >= 0 && value <= max && (!integer || Number.isInteger(value));
  function editCandidate(original, values, originalDateInput) {
    const candidate = structuredClone(original);
    candidate.title = String(values.title || '').trim();
    candidate.feedback = String(values.feedback || '').slice(0, 1500);
    candidate.effort = String(values.effort || '');
    if (!candidate.title || candidate.title.length > 100) throw Error('Informe o nome da sessão.');
    if (values.date !== originalDateInput) {
      const d = new Date(values.date);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.date) || !Number.isFinite(d.getTime()) || new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) !== values.date) throw Error('Informe uma data válida.');
      candidate.date = d.toISOString();
    }
    const num = (name, max, integer = false) => {
      const value = values[name] === '' || values[name] === undefined ? null : Number(values[name]);
      if (value !== null && !finite(value, max, integer)) throw Error('Revise os valores numéricos da sessão.');
      return value;
    };
    candidate.records = candidate.records.filter((r, i) => {
      if (values['remove' + i]) return false;
      r.load = num('load' + i, 2000);
      r.rir = num('rir' + i, 10, true);
      if (r.executionMode === 'timed' || r.executionMode === 'cardio') {
        r.durationSeconds = num('duration' + i, 86400, true);
        if (!(r.durationSeconds > 0)) throw Error('A duração deve ser maior que zero.');
        if (r.executionMode === 'cardio') r.distanceKm = num('distance' + i, 1000);
        r.reps = r.durationSeconds + ' s' + (r.executionMode === 'cardio' ? ' · ' + (r.distanceKm || 0) + ' km' : '');
      } else {
        r.reps = String(values['reps' + i] || '').trim();
        if (!('left' + i in values) && (!/^\d+$/.test(r.reps) || Number(r.reps) < 1 || Number(r.reps) > 500)) throw Error('Informe repetições inteiras de 1 a 500.');
        if ('left' + i in values) {
          r.left = String(num('left' + i, 500, true) ?? '');
          r.right = String(num('right' + i, 500, true) ?? '');
          if (!(Number(r.left) > 0 && Number(r.right) > 0)) throw Error('Registre os dois lados.');
          r.reps = 'E: ' + r.left + ' · D: ' + r.right;
        }
      }
      r.blocks?.forEach((b, n) => {
        b.load = num('blockload' + i + '_' + n, 2000);
        b.reps = num('blockreps' + i + '_' + n, 500, true);
        if (b.load === null || !(b.reps > 0)) throw Error('Preencha os blocos adicionais.');
      });
      return true;
    });
    if (!candidate.records.length) throw Error('Mantenha ao menos uma série na sessão.');
    candidate.editedAt = new Date().toISOString();
    // Old suggestions refer to the old performance and must be discarded after a correction.
    candidate.suggestions = [];
    return candidate;
  }
  function replaceSession(data, original, candidate) {
    const index = data.sessions.findIndex(s => s.id === original.id);
    if (index < 0) throw Error('A sessão foi removida. A correção não foi salva.');
    if (JSON.stringify(data.sessions[index]) !== JSON.stringify(original)) throw Error('A sessão mudou desde que você abriu o editor. Abra novamente para revisar.');
    const next = structuredClone(data);
    next.sessions[index] = structuredClone(candidate);
    return next;
  }
  function points(rows, metric) {
    if (!['load','volume','estimated1RM','reps','durationSeconds','distanceKm'].includes(metric)) return [];
    const groups = new Map();
    for (const row of rows) {
      if (['load','volume','estimated1RM','reps'].includes(metric) && row.executionMode !== 'reps') continue;
      if (['durationSeconds','distanceKm'].includes(metric) && row.executionMode === 'reps') continue;
      const value = row[metric];
      if (!Number.isFinite(value) || value < 0) continue;
      const existing = groups.get(row.session);
      if (!existing) groups.set(row.session, { session:row.session, date:row.date, value });
      else existing.value = ['volume','durationSeconds','distanceKm'].includes(metric) ? existing.value + value : Math.max(existing.value, value);
    }
    return [...groups.values()].sort((a,b) => Date.parse(a.date) - Date.parse(b.date) || String(a.session).localeCompare(String(b.session)));
  }
  return { editCandidate, replaceSession, points };
});
