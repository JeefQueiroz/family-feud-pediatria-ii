/* Family Feud Pediatria II: nenhuma biblioteca externa; sincronização local por aba. */
(() => {
  'use strict';
  const STORAGE = 'pediatria-feud-state-v1';
  const CHANNEL = 'pediatria-feud-v1';
  const isAdmin = document.body.dataset.page === 'admin';
  const gameMount = document.getElementById('game-mount');
  const controlMount = document.getElementById('control-mount');
  const initial = () => ({mode:'round',round:0,r1:0,team1:'EQUIPE 1',team2:'EQUIPE 2',score1:0,score2:0,multiplier:1,revealed:[],strikes:0,awarded:false,r1ShowAnswer:false,r1Awarded:false,lastAward:null,rev:0});
  let state = initial();
  let content = null;
  let audioContext = null;
  let soundEnabled = false;
  let channel = null;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeIndex = (value, count) => Math.max(0,Math.min(count-1,Number.isInteger(+value)? +value:0));
  const points = () => content?.pointsPerHit || 10;
  const currentRound = () => content?.rounds[safeIndex(state.round,content.rounds.length)];
  const currentR1 = () => content?.r1[safeIndex(state.r1,content.r1.length)];
  const validRevealed = () => [...new Set(state.revealed)].filter(i => Number.isInteger(i) && i>=0 && i<(currentRound()?.answers?.length||0));
  const pot = () => validRevealed().length * points() * state.multiplier;
  function normalize(parsed) {
    if (!parsed || typeof parsed !== 'object') return initial();
    const base=initial();
    for (const key of Object.keys(base)) if (Object.prototype.hasOwnProperty.call(parsed,key)) base[key]=parsed[key];
    base.mode=base.mode==='r1'?'r1':'round';
    base.round=safeIndex(base.round,content.rounds.length);
    base.r1=safeIndex(base.r1,content.r1.length);
    base.multiplier=[1,2,3].includes(+base.multiplier)? +base.multiplier:1;
    for (const k of ['score1','score2']) base[k]=Math.max(0,Number.isFinite(+base[k])? Math.floor(+base[k]):0);
    base.team1=String(base.team1||'EQUIPE 1').slice(0,38);
    base.team2=String(base.team2||'EQUIPE 2').slice(0,38);
    base.revealed=Array.isArray(base.revealed)?base.revealed:[];
    base.strikes=Math.max(0,Math.min(3,Number(base.strikes)||0));
    base.rev=Math.max(0,Number(base.rev)||0);
    return base;
  }
  function save() {
    state.rev=(Number(state.rev)||0)+1;
    try {localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){console.warn('Sem persistência local',e);}
    try {channel?.postMessage({type:'sync',state});}catch(e){console.warn('Canal indisponível',e);}
    render();
  }
  function mutate(fn){if(!isAdmin || !content) return; fn();save();}
  function receive(next){ if(!content || !next || +next.rev < +state.rev) return; state=normalize(next);render(); }
  function changeRound(i){ mutate(()=>{state.mode='round';state.round=safeIndex(i,content.rounds.length);state.revealed=[];state.strikes=0;state.awarded=false;state.lastAward=null;}); }
  function changeR1(i){ mutate(()=>{state.mode='r1';state.r1=safeIndex(i,content.r1.length);state.strikes=0;state.r1ShowAnswer=false;state.r1Awarded=false;state.lastAward=null;}); }
  function award(team){mutate(()=>{
    if (![1,2].includes(team)) return;
    if (state.mode==='round' && !state.awarded && pot()>0){
      const amount=pot(); state['score'+team]+=amount;state.awarded=true;state.lastAward={team,amount,mode:state.mode,index:state.round}; playSound('win');
    } else if(state.mode==='r1' && state.r1ShowAnswer && !state.r1Awarded){
      state['score'+team]+=points();state.r1Awarded=true;state.lastAward={team,amount:points(),mode:state.mode,index:state.r1};playSound('win');
    }
  });}
  function undoAward(){mutate(()=>{
    const a=state.lastAward;
    if(!a || a.mode!==state.mode || a.index!==(state.mode==='round'?state.round:state.r1))return;
    state['score'+a.team]=Math.max(0,state['score'+a.team]-a.amount);
    if(a.mode==='round') state.awarded=false;else state.r1Awarded=false;
    state.lastAward=null;
  });}
  function playSound(which){ if(!soundEnabled)return;
    try{
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==='suspended')audioContext.resume();
      const tones=which==='wrong'? [150,115]:which==='win'?[523,659,784,1046]:[784,1046];
      tones.forEach((freq,i)=>{
        const osc=audioContext.createOscillator(), gain=audioContext.createGain();
        osc.type=which==='wrong'?'sawtooth':'sine';osc.frequency.value=freq;
        const start=audioContext.currentTime+i*.1;
        gain.gain.setValueAtTime(.12,start);gain.gain.exponentialRampToValueAtTime(.001,start+.22);
        osc.connect(gain);gain.connect(audioContext.destination);osc.start(start);osc.stop(start+.23);
      });
    }catch(e){ console.warn('Áudio não disponível',e); }
  }
  function scoreMarkup(){return `<div class="scoreboard"><div class="team-score"><div class="score-caption">${esc(state.team1)}</div><div class="score-number">${state.score1}</div></div><div class="round-score"><div class="score-caption">${state.mode==='round'?'BANCO DA RODADA':'VALOR DA QUESTÃO'}</div><div class="pot-number">${state.mode==='round'?pot():points()}</div><div class="score-sub">${state.mode==='round'?`ACERTOS ${validRevealed().length} · ${state.multiplier}×`:'DESAFIO PRÁTICO'}</div></div><div class="team-score"><div class="score-caption">${esc(state.team2)}</div><div class="score-number">${state.score2}</div></div></div>`;}
  function stageRound(){const q=currentRound();if(!q)return `<div class="waiting">Sem perguntas aprovadas.</div>`;
    const cards=Array.from({length:8},(_,i)=>{const a=q.answers[i];const revealed=state.revealed.includes(i);
      if(!a) return `<div class="answer-slot empty" aria-hidden="true"></div>`;
      return `<button class="answer-slot ${revealed?'is-revealed':''} ${isAdmin&&!state.awarded?'clickable':''}" type="button" ${isAdmin&&!state.awarded?`data-answer="${i}"`:'disabled'} aria-label="Resposta ${i+1}, ${revealed?'revelada':'oculta'}"><span class="slot-inner"><span class="slot-front"><b>${i+1}</b></span><span class="slot-back"><span class="answer-label">${esc(a.label)}</span><strong class="answer-points">${a.points}</strong></span></span></button>`;}).join('');
    return `<section class="stage"><div class="stage-kicker">RODADA ${state.round+1} / ${content.rounds.length} <span>·</span> ${esc(q.title)}</div><h2 class="stage-question">${esc(q.question)}</h2>${scoreMarkup()}<div class="answer-grid">${cards}</div><div class="stage-footer"><span>${state.strikes?`<span class="strikes">${'✕'.repeat(state.strikes)}</span>`:'RESPOSTAS OCULTAS · AGUARDANDO ACERTOS'}</span><span>10 PONTOS POR RESPOSTA</span></div></section>`;}
  function stageR1(){const q=currentR1();if(!q)return `<div class="waiting">Sem desafios.</div>`;
    return `<section class="stage"><div class="stage-kicker">QUEM QUER SER UM R1? <span>·</span> DESAFIO ${state.r1+1} / ${content.r1.length}</div><h2 class="stage-question">${esc(q.prompt)}</h2>${scoreMarkup()}<div class="r1-choices">${q.options.map((option,i)=>`<div class="r1-option ${state.r1ShowAnswer && i===q.correct?'correct':''} ${state.r1ShowAnswer && i!==q.correct?'muted':''}"><span class="letter">${'ABCD'[i]}</span><span>${esc(option)}</span>${state.r1ShowAnswer && i===q.correct?'<span class="tick">✓</span>':''}</div>`).join('')}</div><div class="stage-footer">${state.r1ShowAnswer?'<span class="good-answer">GABARITO REVELADO</span>':'<span>ESCOLHAM UMA ALTERNATIVA</span>'}<span>10 PONTOS POR ACERTO</span></div></section>`;}
  function stage(){return state.mode==='r1'?stageR1():stageRound();}
  function render(){if(!content) return;gameMount.innerHTML=stage();if(isAdmin)renderAdmin();}
  function renderAdmin(){
    const isRound=state.mode==='round', q=isRound?currentRound():currentR1();
    const completed=isRound?state.awarded:state.r1Awarded;
    const canAward=isRound?pot()>0&&!completed:state.r1ShowAnswer&&!completed;
    controlMount.innerHTML=`<div class="panel-title"><div><div class="eyebrow">CENTRAL DE CONTROLE</div><h2>Painel do apresentador</h2></div><span class="pill">${content.rounds.length} + ${content.r1.length}</span></div>
    <div class="tabs"><button data-action="mode-round" class="${isRound?'active':''}">Family Feud</button><button data-action="mode-r1" class="${!isRound?'active':''}">Quem quer ser um R1?</button></div>
    <div class="control-group"><label class="small-label" for="question-picker">${isRound?'Rodada e tema':'Questão prática'}</label><select id="question-picker" data-select="${isRound?'round':'r1'}">${(isRound?content.rounds:content.r1).map((x,i)=>`<option value="${i}" ${(isRound?state.round:state.r1)===i?'selected':''}>${i+1}. ${esc(x.title)}</option>`).join('')}</select><div class="button-row"><button data-action="prev" class="button secondary">← Anterior</button><button data-action="next" class="button secondary">Próxima →</button></div></div>
    <div class="control-group"><div class="row-heading"><h3>Equipes</h3><span class="muted-text">Placar acumulado</span></div><div class="team-inputs"><label>Equipe 1<input data-name="team1" maxlength="38" value="${esc(state.team1)}"></label><label>Equipe 2<input data-name="team2" maxlength="38" value="${esc(state.team2)}"></label></div><div class="manual-scores"><div><button class="tiny" data-action="score1-minus">−10</button><b>${state.score1}</b><button class="tiny" data-action="score1-plus">+10</button></div><div><button class="tiny" data-action="score2-minus">−10</button><b>${state.score2}</b><button class="tiny" data-action="score2-plus">+10</button></div></div></div>
    ${isRound?`<div class="control-group"><div class="row-heading"><h3>Respostas</h3><span class="pill">${validRevealed().length} / ${q.answers.length}</span></div><p class="muted-text">Revele quando a equipe acertar. Cada cartão vale <b>10 pontos</b>.</p><div class="host-answers">${q.answers.map((a,i)=>`<button class="host-answer ${state.revealed.includes(i)?'selected':''}" data-action="answer" data-index="${i}" ${completed?'disabled':''}><span>${i+1}. ${esc(a.label)}</span><b>${state.revealed.includes(i)?'✓ 10':'10'}</b></button>`).join('')}</div><div class="button-row"><button class="button secondary" data-action="reveal-all" ${completed?'disabled':''}>Revelar todas</button><button class="button secondary" data-action="hide-all" ${completed?'disabled':''}>Ocultar todas</button></div></div><div class="control-group"><div class="row-heading"><h3>Multiplicador</h3><span class="muted-text">Somente Family Feud</span></div><div class="multiplier-row">${[1,2,3].map(m=>`<button data-action="multiplier" data-mult="${m}" class="${state.multiplier===m?'active':''}" ${completed?'disabled':''}>${m}×</button>`).join('')}</div><div class="button-row"><button class="button danger" data-action="strike" ${state.strikes>=3?'disabled':''}>Erro ✕ (${state.strikes}/3)</button><button class="button secondary" data-action="clear-strikes">Limpar erros</button></div></div>`:
    `<div class="control-group"><h3>Gabarito da questão</h3><p class="muted-text">A equipe escolhe a alternativa. Revele o gabarito somente após as respostas.</p><button class="button ${state.r1ShowAnswer?'secondary':'primary'} full" data-action="show-r1">${state.r1ShowAnswer?'Ocultar gabarito':'Revelar gabarito'}</button><div class="answer-key">Resposta: <b>${'ABCD'[q.correct]} — ${esc(q.options[q.correct])}</b></div><details><summary>Explicação para o apresentador</summary><p>${esc(q.explanation)}</p></details></div>`}
    <div class="control-group award-group"><h3>Conceder pontos</h3><p class="muted-text">${isRound?`Pontos da rodada: <b>${pot()}</b> (${validRevealed().length} acertos × 10 × ${state.multiplier})`:'Questão prática: 10 pontos quando a equipe acertar.'}</p><div class="button-row"><button data-action="award1" class="button primary" ${!canAward?'disabled':''}>+ ${isRound?pot():10} · ${esc(state.team1)}</button><button data-action="award2" class="button gold" ${!canAward?'disabled':''}>+ ${isRound?pot():10} · ${esc(state.team2)}</button></div><div class="button-row"><button data-action="undo" class="button secondary" ${!state.lastAward?'disabled':''}>Desfazer última premiação</button><button data-action="reset" class="button danger-outline">Zerar placares</button></div>${completed?'<div class="success">Pontuação registrada. Avance para a próxima questão.</div>':''}</div>
    <details class="notes"><summary>Notas da apresentação</summary><p>${esc(isRound?q.notes:q.explanation)}</p>${isRound?`<ol>${q.answers.map((a)=>`<li><b>${esc(a.label)}</b>: ${esc(a.detail)}</li>`).join('')}</ol>`:''}</details>
    <p class="privacy-note">Esta página não exige login. Não divulgue o endereço do painel administrativo sem proteção de acesso.</p>`;
  }
  if(isAdmin){
    controlMount?.addEventListener('click',event=>{
      const button=event.target.closest('button[data-action]');if(!button || button.disabled || !content)return;
      const action=button.dataset.action;
      if(action==='mode-round')changeRound(state.round);
      else if(action==='mode-r1')changeR1(state.r1);
      else if(action==='prev')state.mode==='round'?changeRound((state.round+content.rounds.length-1)%content.rounds.length):changeR1((state.r1+content.r1.length-1)%content.r1.length);
      else if(action==='next')state.mode==='round'?changeRound((state.round+1)%content.rounds.length):changeR1((state.r1+1)%content.r1.length);
      else if(action==='answer')mutate(()=>{if(state.awarded)return;const i=+button.dataset.index;state.revealed=state.revealed.includes(i)?state.revealed.filter(x=>x!==i):[...state.revealed,i];if(state.revealed.includes(i))playSound('correct');});
      else if(action==='reveal-all')mutate(()=>{if(!state.awarded)state.revealed=currentRound().answers.map((_,i)=>i);});
      else if(action==='hide-all')mutate(()=>{if(!state.awarded)state.revealed=[];});
      else if(action==='multiplier')mutate(()=>{if(!state.awarded)state.multiplier=+button.dataset.mult;});
      else if(action==='strike')mutate(()=>{state.strikes=Math.min(3,state.strikes+1);playSound('wrong');});
      else if(action==='clear-strikes')mutate(()=>state.strikes=0);
      else if(action==='show-r1')mutate(()=>{if(!state.r1Awarded)state.r1ShowAnswer=!state.r1ShowAnswer;});
      else if(action==='award1')award(1);
      else if(action==='award2')award(2);
      else if(action==='undo')undoAward();
      else if(action.startsWith('score'))mutate(()=>{const team=action.includes('score1')?1:2;const amount=action.endsWith('plus')?10:-10;state['score'+team]=Math.max(0,state['score'+team]+amount);});
      else if(action==='reset' && window.confirm('Zerar os dois placares?'))mutate(()=>{state.score1=0;state.score2=0;state.awarded=false;state.r1Awarded=false;state.lastAward=null;});
    });
    controlMount?.addEventListener('change',event=>{const el=event.target;
      if(el.dataset.select==='round')changeRound(+el.value);
      if(el.dataset.select==='r1')changeR1(+el.value);
    });
    controlMount?.addEventListener('input',event=>{const el=event.target;
      if(el.dataset.name){const pos=el.selectionStart;const value=el.value;mutate(()=>state[el.dataset.name]=value.slice(0,38));const field=controlMount.querySelector(`input[data-name="${el.dataset.name}"]`);if(field){field.focus();try{field.setSelectionRange(pos,pos)}catch(e){}}}
    });
    gameMount?.addEventListener('click',event=>{const b=event.target.closest('button[data-answer]');if(!b || state.mode!=='round'||state.awarded)return;const index=+b.dataset.answer;mutate(()=>state.revealed=state.revealed.includes(index)?state.revealed.filter(x=>x!==index):[...state.revealed,index]);});
    document.addEventListener('keydown',event=>{if(!content || event.ctrlKey||event.altKey||event.metaKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      if(state.mode==='round' && /^[1-8]$/.test(event.key)){const i=+event.key-1;if(i<currentRound().answers.length&&!state.awarded)mutate(()=>state.revealed=state.revealed.includes(i)?state.revealed.filter(x=>x!==i):[...state.revealed,i]);}
      else if(event.key.toLowerCase()==='x' && state.mode==='round')mutate(()=>state.strikes=Math.min(3,state.strikes+1));
      else if(event.key==='ArrowRight')state.mode==='round'?changeRound((state.round+1)%content.rounds.length):changeR1((state.r1+1)%content.r1.length);
      else if(event.key==='ArrowLeft')state.mode==='round'?changeRound((state.round+content.rounds.length-1)%content.rounds.length):changeR1((state.r1+content.r1.length-1)%content.r1.length);
    });
  }
  document.getElementById('fullscreen-button')?.addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();});
  document.getElementById('sound-button')?.addEventListener('click',async e=>{soundEnabled=!soundEnabled;e.currentTarget.textContent=soundEnabled?'Som ativo':'Ativar som';if(soundEnabled)playSound('correct');});
  async function start(){try{
    const response=await fetch('/data.json',{cache:'no-store'});if(!response.ok)throw new Error('Falha ao carregar banco de perguntas');
    content=await response.json();if(!Array.isArray(content.rounds)||!Array.isArray(content.r1)||content.rounds.length===0)throw new Error('Dados incompletos');
    try{state=normalize(JSON.parse(localStorage.getItem(STORAGE)||'null'));}catch(e){state=initial();}
    if('BroadcastChannel' in window){channel=new BroadcastChannel(CHANNEL);channel.addEventListener('message',event=>{if(event.data?.type==='sync')receive(event.data.state);else if(event.data?.type==='request' && isAdmin)channel.postMessage({type:'sync',state});});channel.postMessage({type:'request'});}
    window.addEventListener('storage',event=>{if(event.key===STORAGE && event.newValue){try{receive(JSON.parse(event.newValue));}catch(e){}}});
    render();document.getElementById('connection')?.replaceChildren(document.createTextNode('TV pronta'));
  }catch(e){gameMount.innerHTML=`<div class="waiting">Não foi possível iniciar: ${esc(e.message)}</div>`;console.error(e);}}
  start();
})();
