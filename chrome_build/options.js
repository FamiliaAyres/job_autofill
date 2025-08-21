(function(){
  const $ = (id) => document.getElementById(id);
  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

  // Campos “comuns” sugeridos (você pode adicionar/remover aqui)
  const PRESET_FIELDS = [
    'firstName','lastName','email','phone','phoneCountryCode','address','city','county','postcode','country',
    'linkedin','visa','salary','gender','disabilityStatus','rightToWork','noticePeriod','portfolioUrl','github','website'
  ];

  function makeRow(key='', val='') {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.innerHTML = `
      <input class="k" placeholder="field key (ex: firstName)" value="${key}">
      <input class="v" placeholder="field value" value="${val}">
      <span class="del" title="Remove">✕</span>
    `;
    wrap.querySelector('.del').addEventListener('click', ()=> wrap.remove());
    return wrap;
  }

  function renderPresets() {
    const box = $('presets');
    box.innerHTML = '';
    PRESET_FIELDS.forEach(k => {
      const el = document.createElement('span');
      el.className = 'preset';
      el.textContent = k;
      el.addEventListener('click', ()=>{
        $('rows').appendChild(makeRow(k,''));
      });
      box.appendChild(el);
    });
  }

  async function load() {
    try {
      let data = {};
      if (hasStorage) {
        data = await new Promise(res => chrome.storage.sync.get(null, res));
      } else {
        const raw = localStorage.getItem('jobAutofillProfile');
        if (raw) data = JSON.parse(raw);
      }
      // filtra chaves “internas” (mappings etc.)
      const profile = {...data};
      delete profile.mappings;
      // render
      $('rows').innerHTML = '';
      Object.keys(profile).forEach(k => $('rows').appendChild(makeRow(k, String(profile[k] ?? ''))));
      if ($('rows').children.length === 0) {
        // adiciona linhas básicas
        ['firstName','lastName','email','phone','address','city','postcode','country','linkedin','visa','salary']
          .forEach(k => $('rows').appendChild(makeRow(k,'')));
      }
      renderPresets();
    } catch (e) {
      console.error(e);
    }
  }

  function collect() {
    const rows = Array.from(document.querySelectorAll('.row'));
    const out = {};
    rows.forEach(r => {
      const k = r.querySelector('.k').value.trim();
      const v = r.querySelector('.v').value.trim();
      if (k) out[k] = v;
    });
    return out;
  }

  async function save() {
    const profile = collect();
    try {
      if (hasStorage) {
        chrome.storage.sync.get(['mappings'], (data) => {
          const payload = { ...profile, mappings: data.mappings || {} };
          chrome.storage.sync.set(payload, ()=>{
            $('status').textContent = 'Saved!';
            setTimeout(()=> $('status').textContent = '', 1500);
          });
        });
      } else {
        const raw = localStorage.getItem('jobAutofillProfile');
        let existing = {};
        if (raw) existing = JSON.parse(raw);
        const payload = { ...profile, mappings: existing.mappings || {} };
        localStorage.setItem('jobAutofillProfile', JSON.stringify(payload));
        $('status').textContent = 'Saved (local)!';
        setTimeout(()=> $('status').textContent = '', 1500);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function exportJSON() {
    const data = collect();
    $('io').value = JSON.stringify(data, null, 2);
  }

  function importJSON() {
    try {
      const data = JSON.parse($('io').value || '{}');
      $('rows').innerHTML = '';
      Object.entries(data).forEach(([k,v]) => $('rows').appendChild(makeRow(k, String(v ?? ''))));
      $('status').textContent = 'Imported (not saved yet)';
    } catch(e) {
      alert('JSON inválido');
    }
  }

  $('addRow').addEventListener('click', ()=> $('rows').appendChild(makeRow()));
  $('save').addEventListener('click', save);
  $('export').addEventListener('click', exportJSON);
  $('importBtn').addEventListener('click', importJSON);
  load();
})();
