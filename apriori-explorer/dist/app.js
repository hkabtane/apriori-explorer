const example = [
  'pain, lait, beurre',
  'pain, lait, beurre',
  'pain, lait, beurre',
  'pain, lait, œufs',
  'pain, œufs',
  'pain, œufs',
  'lait, œufs',
  'lait, beurre'
];

const $ = id => document.getElementById(id);
const ui = {
  timeline: $('timeline'), baskets: $('baskets'), candidates: $('candidates'), insight: $('insight'),
  title: $('step-title'), description: $('step-description'), badge: $('step-badge'),
  candidateHeading: $('candidate-heading'), candidateCount: $('candidate-count'),
  basketCount: $('basket-count'), prev: $('prev'), next: $('next'), play: $('play'), reset: $('reset'),
  progressLabel: $('progress-label'), progressFill: $('progress-fill'), transactions: $('transactions'),
  support: $('support'), confidence: $('confidence'), supportValue: $('support-value'),
  confidenceValue: $('confidence-value'), apply: $('apply'), error: $('form-error'), results: $('results')
};

let data = [];
let steps = [];
let levels = [];
let current = 0;
let selectedKey = null;
let timer = null;
let minSupport = 3;
let minConfidence = .7;

const key = items => items.join('\u0001');
const label = items => items.join(' + ');
const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const contains = (basket, items) => items.every(item => basket.includes(item));
const count = items => data.reduce((n, basket) => n + Number(contains(basket, items)), 0);
const sorted = items => [...items].sort((a,b) => a.localeCompare(b, 'fr'));
const subsets = items => items.map((_, i) => items.filter((__, j) => j !== i));

function parseInput(raw) {
  const baskets = raw.split(/\r?\n/).map(line => sorted([...new Set(line.split(',').map(x => x.trim().toLocaleLowerCase('fr')).filter(Boolean))])).filter(x => x.length);
  if (!baskets.length) throw new Error('Ajoutez au moins un panier.');
  if (baskets.length > 40) throw new Error('Limite pédagogique : 40 paniers.');
  const items = new Set(baskets.flat());
  if (items.size > 12) throw new Error('Limite pédagogique : 12 produits distincts.');
  return baskets;
}

function buildAlgorithm() {
  steps = [{type:'intro', level:0, title:'Découvrir les paniers', description:'Chaque ligne est une transaction. Apriori cherche les groupes de produits qui reviennent assez souvent.', items:[]}];
  levels = [];
  let previous = [];
  const allItems = sorted([...new Set(data.flat())]);
  let k = 1;
  while (k <= allItems.length) {
    let candidates = [];
    let pruned = [];
    if (k === 1) {
      candidates = allItems.map(item => [item]);
    } else {
      const seen = new Set();
      for (let i=0; i<previous.length; i++) {
        for (let j=i+1; j<previous.length; j++) {
          const joined = sorted([...new Set([...previous[i].items, ...previous[j].items])]);
          if (joined.length !== k || seen.has(key(joined))) continue;
          seen.add(key(joined));
          if (subsets(joined).every(s => previous.some(p => key(p.items) === key(s)))) candidates.push(joined);
          else pruned.push(joined);
        }
      }
      if (!candidates.length && !pruned.length) break;
    }
    const counted = candidates.map(items => ({items, support:count(items), frequent:count(items)>=minSupport}));
    const rejected = pruned.map(items => ({items, support:null, frequent:false, pruned:true}));
    if (k > 1) steps.push({type:'generate', level:k, title:`Construire les groupes de ${k}`, description:`Apriori associe les groupes fréquents de ${k-1} produit${k-1>1?'s':''}. Un candidat est écarté dès qu’un de ses sous-groupes n’est pas fréquent.`, items:[...counted, ...rejected]});
    steps.push({type:'count', level:k, title:`Compter les groupes de ${k}`, description:`On parcourt les ${data.length} paniers et on compte ceux qui contiennent chaque groupe. Cliquez sur un groupe pour voir ses paniers.`, items:counted});
    steps.push({type:'filter', level:k, title:`Garder les groupes fréquents`, description:`Un groupe survit si son support atteint au moins ${minSupport} panier${minSupport>1?'s':''}. Les autres sont éliminés.`, items:counted});
    const frequent = counted.filter(c => c.frequent);
    levels.push({k, candidates:counted, frequent, pruned:rejected});
    if (!frequent.length || k >= allItems.length) break;
    previous = frequent;
    k++;
  }
  steps.push({type:'rules', level:0, title:'Lire les associations', description:'À partir des groupes fréquents, on peut formuler des règles et mesurer leur confiance.', items:levels.flatMap(l => l.frequent).filter(x => x.items.length>1)});
}

function makeRules() {
  const rules = [];
  const frequent = levels.flatMap(l => l.frequent);
  for (const group of frequent.filter(x => x.items.length > 1)) {
    for (let mask=1; mask < (1 << group.items.length)-1; mask++) {
      const left = group.items.filter((_,i) => mask & (1<<i));
      const right = group.items.filter((_,i) => !(mask & (1<<i)));
      const confidence = group.support / count(left);
      if (confidence >= minConfidence) rules.push({left,right,confidence,support:group.support});
    }
  }
  return rules.sort((a,b) => b.confidence-a.confidence || b.support-a.support || label(a.left).localeCompare(label(b.left),'fr'));
}

function renderTimeline() {
  ui.timeline.innerHTML = steps.map((step,i) => `<button type="button" class="${i===current?'active':''}" data-step="${i}" ${i===current?'aria-current="step"':''}><span class="num">${String(i+1).padStart(2,'0')}</span><span>${escapeHTML(step.title)}${step.level?` <small>· N${step.level}</small>`:''}</span></button>`).join('');
  ui.timeline.querySelectorAll('button').forEach(button => button.addEventListener('click', () => go(Number(button.dataset.step))));
}

function renderBaskets(selected) {
  ui.basketCount.textContent = `· ${data.length}`;
  ui.baskets.innerHTML = data.map((basket,i) => {
    const match = selected && contains(basket,selected);
    return `<div class="basket ${selected?(match?'match':'dim'):''}"><span class="basket-index">T${String(i+1).padStart(2,'0')}</span><div class="chips">${basket.map(item => `<span class="chip ${selected&&selected.includes(item)?'hot':''}">${escapeHTML(item)}</span>`).join('')}</div></div>`;
  }).join('');
}

function renderCandidates(step) {
  ui.candidateHeading.textContent = step.type==='intro'?'PRODUITS':step.type==='rules'?'GROUPES FRÉQUENTS':`CANDIDATS · NIVEAU ${step.level}`;
  const entries = step.type==='intro' ? sorted([...new Set(data.flat())]).map(item => ({items:[item],support:null})) : step.items;
  ui.candidateCount.textContent = `${entries.length} GROUPE${entries.length>1?'S':''}`;
  if (!entries.length) { ui.candidates.innerHTML = '<div class="empty">Aucun candidat à cette étape.</div>'; return; }
  ui.candidates.innerHTML = entries.map((entry,index) => {
    const isSelected = selectedKey === key(entry.items);
    const status = entry.pruned?'pruned':step.type==='filter'&&!entry.frequent?'infrequent':'';
    const number = entry.pruned?'ÉLAGUÉ':entry.support===null?'—':step.type==='generate'?'À COMPTER':`${entry.support} / ${data.length}`;
    return `<button class="candidate ${status} ${isSelected?'selected':''}" type="button" data-index="${index}" aria-pressed="${isSelected}"><span class="candidate-name">${escapeHTML(label(entry.items))}</span><span class="candidate-count">${number}</span></button>`;
  }).join('');
  ui.candidates.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {selectedKey=key(entries[Number(button.dataset.index)].items); render();}));
}

function renderInsight(step, selected) {
  const entry = step.items.find(x => key(x.items)===selectedKey);
  let icon='✳', title='Le principe', body='', formula='', note='';
  if (step.type==='intro') {
    title='Une question simple'; body='Quels produits apparaissent souvent ensemble ? Apriori répond en explorant d’abord les produits seuls, puis les paires, puis les groupes plus grands.';
    formula=`Support minimum = ${minSupport} / ${data.length} paniers`; note='Sélectionnez un produit pour voir dans quels paniers il apparaît.';
  } else if (step.type==='generate') {
    icon='↗'; title=entry?.pruned?'Candidat élagué':'De nouveaux candidats';
    body=entry?.pruned?`${label(entry.items)} ne sera pas compté : au moins un de ses sous-groupes n’a pas atteint le support minimum.`:`On réunit les groupes du niveau précédent pour obtenir des candidats de ${step.level} produits.`;
    formula=entry?.pruned?`Sous-groupes : ${subsets(entry.items).map(label).join(' · ')}`:`C${step.level} = candidats à tester`;
    note='La propriété Apriori évite de compter les combinaisons impossibles à rendre fréquentes.';
  } else if (step.type==='count') {
    icon='◎'; title=entry?`Compter « ${label(entry.items)} »`:'Compter les occurrences';
    body=entry?`Ce groupe apparaît dans ${entry.support} panier${entry.support>1?'s':''} sur ${data.length}. Les paniers correspondants sont surlignés à gauche.`:'Choisissez un candidat pour visualiser les paniers qui le contiennent.';
    formula=entry?`support(${label(entry.items)}) = ${entry.support} / ${data.length} = ${Math.round(entry.support/data.length*100)} %`:'support(X) = paniers contenant X / total des paniers';
    note=`Seuil demandé : ${minSupport} panier${minSupport>1?'s':''} minimum.`;
  } else if (step.type==='filter') {
    icon=entry?.frequent?'✓':'✕'; title=entry?(entry.frequent?'Groupe conservé':'Groupe éliminé'):'Appliquer le seuil';
    body=entry?`${label(entry.items)} apparaît ${entry.support} fois. ${entry.frequent?'Il pourra servir à construire le niveau suivant.':'Il ne pourra plus servir à construire un groupe plus grand.'}`:'Les groupes en vert atteignent le seuil. Les groupes atténués ne l’atteignent pas.';
    formula=entry?`${entry.support} ${entry.frequent?'≥':'<'} ${minSupport} → ${entry.frequent?'fréquent':'non fréquent'}`:`support ≥ ${minSupport} → groupe fréquent`;
    note='Si un groupe est peu fréquent, tout groupe qui le contient le sera aussi.';
  } else {
    icon='✧'; title='Des groupes aux règles';
    const rule=makeRules()[0];
    body=rule?`Exemple : ${label(rule.left)} → ${label(rule.right)}. Parmi les paniers contenant ${label(rule.left)}, ${Math.round(rule.confidence*100)} % contiennent aussi ${label(rule.right)}.`:'Aucune règle ne franchit le seuil de confiance choisi. Essayez un seuil plus faible.';
    formula=rule?`confiance = support(A ∪ B) / support(A) = ${Math.round(rule.confidence*100)} %`:'confiance(A → B) = support(A ∪ B) / support(A)';
    note='Une association observée ne prouve pas que l’achat d’un produit cause l’achat d’un autre.';
  }
  ui.insight.innerHTML=`<div class="insight-icon">${icon}</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(body)}</p><div class="formula">${escapeHTML(formula)}</div><div class="note">${escapeHTML(note)}</div>`;
}

function renderResults() {
  const groups=levels.flatMap(l=>l.frequent).filter(x=>x.items.length>1);
  const rules=makeRules();
  ui.results.innerHTML=`<div class="result-section"><h3>GROUPES FRÉQUENTS · 2+ PRODUITS</h3>${groups.length?groups.map(x=>`<span class="result-chip">${escapeHTML(label(x.items))} · ${x.support}/${data.length}</span>`).join(''):'<p class="result-empty">Aucun groupe de deux produits n’atteint le support choisi.</p>'}</div><div class="result-section"><h3>RÈGLES · CONFIANCE ≥ ${Math.round(minConfidence*100)} %</h3>${rules.length?rules.slice(0,6).map(r=>`<div class="rule"><b>${escapeHTML(label(r.left))} → ${escapeHTML(label(r.right))}</b><span>${Math.round(r.confidence*100)} %</span></div>`).join(''):'<p class="result-empty">Aucune règle pour ce seuil.</p>'}</div>`;
}

function render() {
  const step=steps[current];
  const selected=selectedKey?.split('\u0001');
  ui.title.textContent=step.title;
  ui.description.textContent=step.description;
  ui.badge.textContent=`ÉTAPE ${String(current+1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}`;
  renderTimeline(); renderBaskets(selected); renderCandidates(step); renderInsight(step,selected);
  ui.prev.disabled=current===0; ui.next.disabled=current===steps.length-1;
  ui.progressLabel.textContent=`${current+1} SUR ${steps.length} ÉTAPES`;
  ui.progressFill.style.width=`${(current+1)/steps.length*100}%`;
  ui.play.innerHTML=timer?'❚❚ <span>Pause</span>':'▶ <span>Lecture</span>';
  ui.play.setAttribute('aria-label',timer?'Mettre en pause':'Lancer l’animation');
}

function stop() { if(timer) clearInterval(timer); timer=null; }
function go(index) { stop(); current=Math.max(0,Math.min(index,steps.length-1)); selectedKey=null; render(); }
function rebuild() {
  try {
    const parsed=parseInput(ui.transactions.value);
    const threshold=Number(ui.support.value);
    if(threshold>parsed.length) throw new Error(`Le support doit être au maximum ${parsed.length}.`);
    data=parsed; minSupport=threshold; minConfidence=Number(ui.confidence.value)/100;
    buildAlgorithm(); stop(); current=0; selectedKey=null; ui.error.textContent=''; render(); renderResults();
  } catch(error) { ui.error.textContent=error.message; }
}

ui.transactions.value=example.join('\n');
ui.support.max=example.length;
ui.support.addEventListener('input',()=>{ui.supportValue.textContent=`${ui.support.value} panier${Number(ui.support.value)>1?'s':''}`;});
ui.confidence.addEventListener('input',()=>{ui.confidenceValue.textContent=`${ui.confidence.value} %`;});
ui.transactions.addEventListener('input',()=>{ui.error.textContent='';});
ui.apply.addEventListener('click',rebuild);
ui.prev.addEventListener('click',()=>go(current-1));
ui.next.addEventListener('click',()=>go(current+1));
ui.reset.addEventListener('click',()=>go(0));
ui.play.addEventListener('click',()=>{
  if(timer){stop();render();return;}
  if(current===steps.length-1)current=0;
  timer=setInterval(()=>{if(current<steps.length-1){current++;selectedKey=null;render();}else{stop();render();}},1500);
  render();
});
document.addEventListener('keydown',event=>{
  if(['TEXTAREA','INPUT'].includes(document.activeElement?.tagName))return;
  if(event.key==='ArrowRight'){event.preventDefault();go(current+1);}
  if(event.key==='ArrowLeft'){event.preventDefault();go(current-1);}
});
rebuild();
