/* Family Feud Pediatria II: nenhuma biblioteca externa; sincronização local por aba. */
(() => {
  'use strict';
  const STORAGE = 'pediatria-feud-state-v1';
  const CHANNEL = 'pediatria-feud-v1';
  const isAdmin = document.body.dataset.page === 'admin';
  const gameMount = document.getElementById('game-mount');
  const controlMount = document.getElementById('control-mount');
  const quickMount = document.getElementById('presenter-quick-controls');
  const initial = () => ({mode:'round',round:0,r1:0,team1:'EQUIPE 1',team2:'EQUIPE 2',score1:0,score2:0,multiplier:1,revealed:[],roundProgress:{},r1Progress:{},effectHistory:[],strikes:0,awarded:false,r1ShowAnswer:false,r1Awarded:false,lastAward:null,activeTeam:1,timerRunning:false,timerEnd:0,timerRemaining:10,rev:0});
  let state = initial();
  let content = null;
  let audioContext = null;
  let soundEnabled = false;
  let tvSnapshotReady = false;
  let pendingGameEffect = null;
  let lastVisualEffectId = 0;
  let visualEffectsReady = false;
  const visualEffectQueue = [];
  let visualEffectPlaying = false;
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
    base.effectHistory=Array.isArray(base.effectHistory)?base.effectHistory.filter(e=>e&&Number.isInteger(e.id)&&e.id>=0&&['award','strike'].includes(e.kind)).slice(-16):[];
    base.roundProgress=base.roundProgress&&typeof base.roundProgress==='object'&&!Array.isArray(base.roundProgress)?base.roundProgress:{};
    base.r1Progress=base.r1Progress&&typeof base.r1Progress==='object'&&!Array.isArray(base.r1Progress)?base.r1Progress:{};
    base.strikes=Math.max(0,Math.min(3,Number(base.strikes)||0));
    base.activeTeam=[1,2].includes(+base.activeTeam)?+base.activeTeam:1;
    base.timerRunning=!!base.timerRunning;
    base.timerEnd=Math.max(0,Number(base.timerEnd)||0);
    base.timerRemaining=Math.max(0,Math.min(10,Number(base.timerRemaining)||0));
    base.rev=Math.max(0,Number(base.rev)||0);
    return base;
  }
  function save() {
    state.rev=(Number(state.rev)||0)+1;
    try {localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){console.warn('Sem persistência local',e);}
    try {channel?.postMessage({type:'sync',state});}catch(e){console.warn('Canal indisponível',e);}
    render();
    window.FFRemote?.publish(state);
  }
  function queueEffect(effect){visualEffectQueue.push(effect);}
  function playQueuedEffects(){
    if(visualEffectPlaying||!visualEffectQueue.length)return;
    visualEffectPlaying=true;
    const effect=visualEffectQueue.shift();
    const notice=document.createElement('div');
    notice.className='game-effect '+(effect.kind==='strike'?'game-effect-strike':'game-effect-award');
    notice.setAttribute('role','status');
    const amount=document.createElement('span');
    amount.textContent=effect.kind==='strike'?'✕':'+'+effect.amount+' PONTOS';
    const label=document.createElement('strong');
    label.textContent=effect.kind==='strike'?'ERROU · PRÓXIMA EQUIPE':(effect.teamName||state['team'+effect.team]||'EQUIPE');
    notice.append(amount,label);
    document.body.appendChild(notice);
    if(effect.kind==='award'){
      const teamCard=document.querySelectorAll('#game-mount .team-score')[effect.team-1];
      if(teamCard){
        teamCard.classList.remove('just-scored');
        void teamCard.offsetWidth;
        teamCard.classList.add('just-scored');
      }
      if(effect.mode==='round'&&state.mode==='round'&&effect.round===state.round&&Number.isInteger(effect.answer)){
        const card=document.querySelectorAll('#game-mount .answer-slot')[effect.answer];
        if(card&&card.classList.contains('is-revealed')){
          card.classList.remove('newly-revealed');
          void card.offsetWidth;
          card.classList.add('newly-revealed');
        }
      }
    }
    if(!isAdmin){
      if(effect.kind==='strike')playSound('wrong');
      else playSound('correct');
    }
    setTimeout(()=>{
      notice.remove();
      visualEffectPlaying=false;
      playQueuedEffects();
    },effect.kind==='strike'?1250:1600);
  }
  function consumeVisualEffects(incoming){
    const events=Array.isArray(incoming.effectHistory)?incoming.effectHistory:[];
    if(!visualEffectsReady){
      visualEffectsReady=true;
      lastVisualEffectId=events.reduce((max,e)=>Math.max(max,e.id),0);
      return;
    }
    for(const effect of events){
      if(effect.id>lastVisualEffectId)queueEffect(effect);
      lastVisualEffectId=Math.max(lastVisualEffectId,effect.id);
    }
  }
  function detectGameEffect(previous,next){
    pendingGameEffect=null;
    if(!previous||!next)return;
    const team=[1,2].find(n=>Number(next['score'+n])>Number(previous['score'+n]));
    if(team){
      const amount=Number(next['score'+team])-Number(previous['score'+team]);
      const sameRound=next.mode==='round'&&previous.mode==='round'&&next.round===previous.round;
      const revealed=sameRound?(next.revealed||[]).filter(i=>!(previous.revealed||[]).includes(i)):[];
      pendingGameEffect={kind:'award',team,teamName:next['team'+team],amount,answer:revealed.length===1?revealed[0]:null,mode:next.mode,round:next.round};
    }else if(next.mode==='round'&&previous.mode==='round'&&next.round===previous.round&&Number(next.strikes)>Number(previous.strikes)){
      pendingGameEffect={kind:'strike',strikes:next.strikes};
    }
  }
  function mutate(fn){
    if(!isAdmin||!content||!window.FFRemote?.available()||!window.FFRemote.canControl())return;
    const previous={...state,revealed:[...state.revealed]};
    fn();
    detectGameEffect(previous,state);
    const effect=pendingGameEffect?{...pendingGameEffect,id:(Number(state.rev)||0)+1}:null;
    if(effect){
      state.effectHistory=[...(state.effectHistory||[]),effect].slice(-16);
      lastVisualEffectId=effect.id;
    }
    save();
    if(effect){queueEffect(effect);playQueuedEffects();}
    pendingGameEffect=null;
  }
  function receive(next){
    if(!content||!next||+next.rev<+state.rev)return;
    consumeVisualEffects(next);
    state=normalize(next);
    tvSnapshotReady=true;
    render();
    playQueuedEffects();
  }
  function secondsRemaining(){return state.timerRunning?Math.max(0,Math.ceil((state.timerEnd-Date.now())/1000)):state.timerRemaining;}
  function resetClock(){state.timerRunning=false;state.timerEnd=0;state.timerRemaining=10;}
  function clockStart(){
    if(state.timerRunning && secondsRemaining()>0)return;
    mutate(()=>{
      const remaining=secondsRemaining();
      const seconds=remaining>0?Math.min(10,remaining):10;
      state.timerRemaining=seconds;
      state.timerEnd=Date.now()+seconds*1000;
      state.timerRunning=true;
    });
    updateClockLabels();
  }
  function clockPause(){
    if(!state.timerRunning)return;
    mutate(()=>{state.timerRemaining=secondsRemaining();state.timerRunning=false;state.timerEnd=0;});
    updateClockLabels();
  }
  function clockReset(){mutate(()=>resetClock());updateClockLabels();}
  function switchTeamAndStartTimer(withStrike){
    mutate(()=>{
      if(state.mode!=='round')return;
      if(withStrike){
        if(state.strikes>=3)return;
        state.strikes=Math.min(3,state.strikes+1);
      }
      state.activeTeam=state.activeTeam===1?2:1;
      state.timerRemaining=10;
      state.timerEnd=Date.now()+10000;
      state.timerRunning=true;
    });
    updateClockLabels();
  }
  function strikeAndSwitch(){if(state.strikes<3)switchTeamAndStartTimer(true);}
  function nextTeam(){switchTeamAndStartTimer(false);}
  function saveCurrentProgress(){
    if(state.mode==='round')state.roundProgress[state.round]=[...state.revealed];
    else state.r1Progress[state.r1]={shown:!!state.r1ShowAnswer,awarded:!!state.r1Awarded};
  }
  function changeRound(i){mutate(()=>{
    saveCurrentProgress();
    state.mode='round';
    state.round=safeIndex(i,content.rounds.length);
    const saved=state.roundProgress[state.round];
    state.revealed=Array.isArray(saved)?saved.filter(n=>Number.isInteger(n)&&n>=0&&n<content.rounds[state.round].answers.length):[];
    state.strikes=0;state.awarded=false;state.lastAward=null;resetClock();state.activeTeam=1;
  });}
  function changeR1(i){mutate(()=>{
    saveCurrentProgress();
    state.mode='r1';
    state.r1=safeIndex(i,content.r1.length);
    const saved=state.r1Progress[state.r1]||{};
    state.r1ShowAnswer=!!saved.shown;state.r1Awarded=!!saved.awarded;
    state.strikes=0;state.lastAward=null;resetClock();state.activeTeam=1;
  });}
  function revealAndScore(i){
    if(state.mode!=='round'||state.awarded||!Number.isInteger(i)||i<0||i>=currentRound().answers.length||state.revealed.includes(i))return;
    state.revealed=[...state.revealed,i];
    state.roundProgress[state.round]=[...state.revealed];
    const team=state.activeTeam;
    const amount=points();
    state['score'+team]+=amount;
    state.lastAward={team,amount,mode:'round',index:state.round,answer:i};
    state.strikes=0;
    resetClock();
    playSound('correct');
  }
  function award(team){mutate(()=>{
    if (![1,2].includes(team)) return;
    if(state.mode==='r1' && state.r1ShowAnswer && !state.r1Awarded){
      state['score'+team]+=points();state.r1Awarded=true;state.r1Progress[state.r1]={shown:true,awarded:true};state.lastAward={team,amount:points(),mode:state.mode,index:state.r1};playSound('win');
    }
  });}
  function undoAward(){mutate(()=>{
    const a=state.lastAward;
    if(!a || a.mode!==state.mode || a.index!==(state.mode==='round'?state.round:state.r1))return;
    state['score'+a.team]=Math.max(0,state['score'+a.team]-a.amount);
    if(a.mode==='round' && Number.isInteger(a.answer)){
      state.revealed=state.revealed.filter(i=>i!==a.answer);
      state.roundProgress[state.round]=[...state.revealed];
    }else if(a.mode==='r1'){
      state.r1Awarded=false;
      state.r1Progress[state.r1]={shown:!!state.r1ShowAnswer,awarded:false};
    }
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
  function scoreMarkup(){return `<div class="scoreboard"><div class="team-score ${!isAdmin && state.activeTeam===1?'is-active-team':''} ${pendingGameEffect?.kind==='award'&&pendingGameEffect.team===1?'just-scored':''}"><div class="score-caption">${esc(state.team1)}</div><div class="score-number">${state.score1}</div></div><div class="round-score"><div class="score-caption">${state.mode==='round'?'RODADA':'VALOR DA QUESTÃO'}</div><div class="pot-number">${state.mode==='round'?state.round+1:points()}</div><div class="score-sub">${state.mode==='round'?`ACERTOS ${validRevealed().length}`:'DESAFIO PRÁTICO'}</div></div><div class="team-score ${!isAdmin && state.activeTeam===2?'is-active-team':''} ${pendingGameEffect?.kind==='award'&&pendingGameEffect.team===2?'just-scored':''}"><div class="score-caption">${esc(state.team2)}</div><div class="score-number">${state.score2}</div></div></div>`;}
  function effectsMarkup(){return '';}
  function stageRound(){const q=currentRound();if(!q)return `<div class="waiting">Sem perguntas aprovadas.</div>`;
    const cards=Array.from({length:8},(_,i)=>{const a=q.answers[i];const revealed=state.revealed.includes(i);
      if(!a) return `<div class="answer-slot empty" aria-hidden="true"></div>`;
      return `<button class="answer-slot ${revealed?'is-revealed':''} ${pendingGameEffect?.kind==='award'&&pendingGameEffect.answer===i?'newly-revealed':''} ${isAdmin&&!state.awarded&&!revealed?'clickable':''}" type="button" ${isAdmin&&!state.awarded&&!revealed?`data-answer="${i}"`:'disabled'} aria-label="${isAdmin?esc(a.label):`Resposta ${i+1}`}, ${revealed?'revelada':'oculta'}"><span class="slot-inner"><span class="slot-front">${isAdmin?`<span class="presenter-answer-text">${esc(a.label)}</span>`:`<b>${i+1}</b>`}</span><span class="slot-back"><span class="answer-label">${esc(a.label)}</span></span></span></button>`;}).join('');
    return `<section class="stage"><div class="stage-kicker">RODADA ${state.round+1} / ${content.rounds.length} <span>·</span> ${esc(q.title)}</div><h2 class="stage-question">${esc(q.question)}</h2>${scoreMarkup()}<div class="answer-grid">${cards}</div>${effectsMarkup()}<div class="stage-footer"><span>${state.strikes?`<span class="strikes">${'✕'.repeat(state.strikes)}</span>`:'RESPOSTAS OCULTAS · AGUARDANDO ACERTOS'}</span><span>10 PONTOS POR RESPOSTA</span></div></section>`;}
  function stageR1(){const q=currentR1();if(!q)return `<div class="waiting">Sem desafios.</div>`;
    return `<section class="stage"><div class="stage-kicker">QUEM QUER SER UM R1? <span>·</span> DESAFIO ${state.r1+1} / ${content.r1.length}</div><h2 class="stage-question">${esc(q.prompt)}</h2>${scoreMarkup()}${effectsMarkup()}<div class="r1-choices">${q.options.map((option,i)=>`<div class="r1-option ${state.r1ShowAnswer && i===q.correct?'correct':''} ${state.r1ShowAnswer && i!==q.correct?'muted':''}"><span class="letter">${'ABCD'[i]}</span><span>${esc(option)}</span>${state.r1ShowAnswer && i===q.correct?'<span class="tick">✓</span>':''}</div>`).join('')}</div><div class="stage-footer">${state.r1ShowAnswer?'<span class="good-answer">GABARITO REVELADO</span>':'<span>ESCOLHAM UMA ALTERNATIVA</span>'}<span>10 PONTOS POR ACERTO</span></div></section>`;}
  function stage(){return state.mode==='r1'?stageR1():stageRound();}
  function updateClockLabels(){
    if(isAdmin && state.timerRunning && secondsRemaining()===0 && window.FFRemote?.canControl()){
      state.timerRunning=false;
      state.timerRemaining=0;
      state.timerEnd=0;
      save();
    }
    document.querySelectorAll('[data-timer-display]').forEach(node=>node.textContent=String(secondsRemaining()));
    if(!isAdmin){
      const tvTimer=document.getElementById('tv-timer-seconds');
      if(tvTimer)tvTimer.textContent=String(secondsRemaining());
      const turn=document.getElementById('turn-indicator');
      const name=state.activeTeam===2?state.team2:state.team1;
      if(turn)turn.textContent='VEZ: '+name;
    }
    document.querySelectorAll('[data-team-display]').forEach(node=>node.textContent=state.team1 && state.team2 ? (state.activeTeam===1?state.team1:state.team2) : 'Equipe '+state.activeTeam);
  }
  setInterval(updateClockLabels,250);

  function renderQuickControls(){
    if(!quickMount)return;
    if(!window.FFRemote?.canControl()){quickMount.innerHTML='';return;}
    const round=state.mode==='round';
    quickMount.innerHTML=`<div class="quick-toolbar">
      <div class="quick-navigation">
        <button class="button secondary" data-action="prev">← Anterior</button>
        <button class="button ${round?'primary':'secondary'}" data-action="mode-round">Family Feud</button>
        <button class="button ${!round?'primary':'secondary'}" data-action="mode-r1">Quem quer ser um R1?</button>
        <button class="button secondary" data-action="next">Próxima →</button>
      </div>
      <div class="quick-team-switch" role="group" aria-label="Selecionar equipe">
        <button class="quick-team ${state.activeTeam===1?'active':''}" data-action="select-team1" aria-pressed="${state.activeTeam===1}"><span>${esc(state.team1)}</span><strong>${state.score1}</strong></button>
        <button class="quick-team ${state.activeTeam===2?'active':''}" data-action="select-team2" aria-pressed="${state.activeTeam===2}"><span>${esc(state.team2)}</span><strong>${state.score2}</strong></button>
      </div>
      ${round?`<div class="next-team-row"><button type="button" class="next-team-button" data-action="next-team">PRÓXIMO GRUPO <span>↔</span> INICIAR 10s</button></div><div class="quick-strike-row"><button type="button" class="quick-strike-button" data-action="strike" ${state.strikes>=3?'disabled':''}><span class="quick-strike-icon">✕</span><span>ERROU / PASSAR VEZ</span><strong>${state.strikes} / 3</strong></button><span class="quick-strike-explain">Marca erro, passa a vez e começa 10 segundos.</span></div>`:''}
      <p class="quick-hint">${round?'Selecione a equipe e toque no número de uma resposta oculta. +10 pontos automaticamente.':'Desafio prático: revele o gabarito e conceda os pontos no painel.'}</p>
    </div>`;
  }
  function render(){if(!content)return;gameMount.innerHTML=stage();if(isAdmin){renderQuickControls();renderAdmin();}pendingGameEffect=null;}
  function renderAdmin(){
    if(!window.FFRemote?.available() || !window.FFRemote.canControl()){
      if(window.FFRemote) window.FFRemote.renderLogin(controlMount);
      else controlMount.innerHTML='<p class="waiting">Biblioteca de controle remoto indisponível. Verifique sua conexão e recarregue.</p>';
      return;
    }
    const isRound=state.mode==='round', q=isRound?currentRound():currentR1();
    const completed=isRound?state.awarded:state.r1Awarded;
    const canAward=!isRound&&state.r1ShowAnswer&&!completed;
    controlMount.innerHTML=`<div class="panel-title"><div><div class="eyebrow">CENTRAL DE CONTROLE</div><h2>Painel do apresentador</h2></div><span class="pill">${content.rounds.length} + ${content.r1.length}</span></div>
    ${isRound?'<div class="control-group"><div class="row-heading"><h3>Turno: <span data-team-display></span></h3><span class="pill"><span data-timer-display>10</span> segundos</span></div><div class="button-row"><button class="button primary" data-action="timer-start">Iniciar 10s</button><button class="button secondary" data-action="timer-pause">Pausar</button><button class="button secondary" data-action="timer-reset">Reiniciar</button></div></div>':''}
    <div class="tabs"><button data-action="mode-round" class="${isRound?'active':''}">Family Feud</button><button data-action="mode-r1" class="${!isRound?'active':''}">Quem quer ser um R1?</button></div>
    <div class="control-group"><label class="small-label" for="question-picker">${isRound?'Rodada e tema':'Questão prática'}</label><select id="question-picker" data-select="${isRound?'round':'r1'}">${(isRound?content.rounds:content.r1).map((x,i)=>`<option value="${i}" ${(isRound?state.round:state.r1)===i?'selected':''}>${i+1}. ${esc(x.title)}</option>`).join('')}</select><div class="button-row"><button data-action="prev" class="button secondary">← Anterior</button><button data-action="next" class="button secondary">Próxima →</button></div></div>
    ${isRound?`<div class="control-group"><div class="row-heading"><h3>Equipe que recebe os pontos</h3><span class="pill">+10 por resposta inédita</span></div><div class="button-row"><button type="button" class="button ${state.activeTeam===1?'primary':'secondary'}" data-action="select-team1" aria-pressed="${state.activeTeam===1}">${esc(state.team1)}</button><button type="button" class="button ${state.activeTeam===2?'primary':'secondary'}" data-action="select-team2" aria-pressed="${state.activeTeam===2}">${esc(state.team2)}</button></div></div>` : ''}
    <div class="control-group"><div class="row-heading"><h3>Equipes</h3><span class="muted-text">Placar acumulado</span></div><div class="team-inputs"><label>Equipe 1<input data-name="team1" maxlength="38" value="${esc(state.team1)}"></label><label>Equipe 2<input data-name="team2" maxlength="38" value="${esc(state.team2)}"></label></div><div class="manual-scores"><div><button class="tiny" data-action="score1-minus">−10</button><b>${state.score1}</b><button class="tiny" data-action="score1-plus">+10</button></div><div><button class="tiny" data-action="score2-minus">−10</button><b>${state.score2}</b><button class="tiny" data-action="score2-plus">+10</button></div></div></div>
    ${isRound?`<div class="control-group"><div class="row-heading"><h3>Respostas</h3><span class="pill">${validRevealed().length} / ${q.answers.length}</span></div><p class="muted-text">Toque em uma resposta oculta para revelá-la e somar 10 pontos à equipe selecionada.</p><div class="host-answers">${q.answers.map((a,i)=>`<button class="host-answer ${state.revealed.includes(i)?'selected':''}" data-action="answer" data-index="${i}" ${completed||state.revealed.includes(i)?'disabled':''}><span>${i+1}. ${esc(a.label)}</span><b>${state.revealed.includes(i)?'✓':'Revelar'}</b></button>`).join('')}</div></div><div class="control-group"><h3>Erros da rodada</h3><div class="button-row"><button class="button danger" data-action="strike" ${state.strikes>=3?'disabled':''}>Erro ✕ (${state.strikes}/3)</button><button class="button secondary" data-action="clear-strikes">Limpar erros</button></div></div>`:
    `<div class="control-group"><h3>Gabarito da questão</h3><p class="muted-text">A equipe escolhe a alternativa. Revele o gabarito somente após as respostas.</p><button class="button ${state.r1ShowAnswer?'secondary':'primary'} full" data-action="show-r1">${state.r1ShowAnswer?'Ocultar gabarito':'Revelar gabarito'}</button><div class="answer-key">Resposta: <b>${'ABCD'[q.correct]} — ${esc(q.options[q.correct])}</b></div><details><summary>Explicação para o apresentador</summary><p>${esc(q.explanation)}</p></details></div>`}
    <div class="control-group award-group"><h3>${isRound?'Correções':'Conceder pontos'}</h3>${!isRound?`<p class="muted-text">Questão prática: 10 pontos quando a equipe acertar.</p><div class="button-row"><button data-action="award1" class="button primary" ${!canAward?'disabled':''}>+10 · ${esc(state.team1)}</button><button data-action="award2" class="button gold" ${!canAward?'disabled':''}>+10 · ${esc(state.team2)}</button></div>`:''}<div class="button-row"><button data-action="undo" class="button secondary" ${!state.lastAward?'disabled':''}>Desfazer último acerto</button><button data-action="reset" class="button danger-outline">Zerar placares</button></div>${completed?'<div class="success">Pontuação registrada. Avance para a próxima questão.</div>':''}</div>
    <details class="notes"><summary>Notas da apresentação</summary><p>${esc(isRound?q.notes:q.explanation)}</p>${isRound?`<ol>${q.answers.map((a)=>`<li><b>${esc(a.label)}</b>: ${esc(a.detail)}</li>`).join('')}</ol>`:''}</details>
    <p class="privacy-note">Acesso ao painel protegido por PIN do apresentador.</p>`;
  }
  if(isAdmin){
    controlMount?.addEventListener('submit',event=>window.FFRemote?.handleSubmit(event));
    const handleControls = event=>{
      if(event.target.closest('[data-auth-logout]')){window.FFRemote?.logout();return;}
      const button=event.target.closest('button[data-action]');if(!button || button.disabled || !content)return;
      const action=button.dataset.action;
      if(action==='mode-round')changeRound(state.round);
      else if(action==='mode-r1')changeR1(state.r1);
      else if(action==='prev')state.mode==='round'?changeRound((state.round+content.rounds.length-1)%content.rounds.length):changeR1((state.r1+content.r1.length-1)%content.r1.length);
      else if(action==='next')state.mode==='round'?changeRound((state.round+1)%content.rounds.length):changeR1((state.r1+1)%content.r1.length);
      else if(action==='answer')mutate(()=>revealAndScore(+button.dataset.index));
      else if(action==='select-team1')mutate(()=>state.activeTeam=1);
      else if(action==='select-team2')mutate(()=>state.activeTeam=2);



      else if(action==='strike')strikeAndSwitch();
      else if(action==='next-team')nextTeam();
      else if(action==='timer-start')clockStart();
      else if(action==='timer-pause')clockPause();
      else if(action==='timer-reset')clockReset();
      else if(action==='clear-strikes')mutate(()=>state.strikes=0);
      else if(action==='show-r1')mutate(()=>{if(!state.r1Awarded){state.r1ShowAnswer=!state.r1ShowAnswer;state.r1Progress[state.r1]={shown:state.r1ShowAnswer,awarded:false};}});
      else if(action==='award1')award(1);
      else if(action==='award2')award(2);
      else if(action==='undo')undoAward();
      else if(action.startsWith('score'))mutate(()=>{const team=action.includes('score1')?1:2;const amount=action.endsWith('plus')?10:-10;state['score'+team]=Math.max(0,state['score'+team]+amount);});
      else if(action==='reset' && window.confirm('Reiniciar a partida? Isso zerará pontos e respostas já reveladas.'))mutate(()=>{state.score1=0;state.score2=0;state.mode='round';state.round=0;state.r1=0;state.revealed=[];state.roundProgress={};state.r1Progress={};state.strikes=0;state.awarded=false;state.r1Awarded=false;state.r1ShowAnswer=false;state.lastAward=null;state.activeTeam=1;resetClock();});
    };
    controlMount?.addEventListener('click',handleControls);
    quickMount?.addEventListener('click',handleControls);
    controlMount?.addEventListener('change',event=>{const el=event.target;
      if(el.dataset.select==='round')changeRound(+el.value);
      if(el.dataset.select==='r1')changeR1(+el.value);
    });
    controlMount?.addEventListener('input',event=>{const el=event.target;
      if(el.dataset.name){const pos=el.selectionStart;const value=el.value;mutate(()=>state[el.dataset.name]=value.slice(0,38));const field=controlMount.querySelector(`input[data-name="${el.dataset.name}"]`);if(field){field.focus();try{field.setSelectionRange(pos,pos)}catch(e){}}}
    });
    gameMount?.addEventListener('click',event=>{const b=event.target.closest('button[data-answer]');if(!b||state.mode!=='round')return;mutate(()=>revealAndScore(+b.dataset.answer));});
    document.addEventListener('keydown',event=>{if(!content || event.ctrlKey||event.altKey||event.metaKey||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      if(state.mode==='round' && /^[1-8]$/.test(event.key)){const i=+event.key-1;if(i<currentRound().answers.length&&!state.awarded)mutate(()=>revealAndScore(i));}
      else if(event.key.toLowerCase()==='x' && state.mode==='round')strikeAndSwitch();
      else if(event.key==='ArrowRight')state.mode==='round'?changeRound((state.round+1)%content.rounds.length):changeR1((state.r1+1)%content.r1.length);
      else if(event.key==='ArrowLeft')state.mode==='round'?changeRound((state.round+content.rounds.length-1)%content.rounds.length):changeR1((state.r1+content.r1.length-1)%content.r1.length);
    });
  }
  if(!isAdmin){
    const unlockAudio=()=>{
      soundEnabled=true;
      try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume?.();}catch(e){console.warn('Audio indisponível',e);}
    };
    document.addEventListener('pointerdown',unlockAudio,{once:true});
    document.addEventListener('keydown',unlockAudio,{once:true});
    document.addEventListener('dblclick',()=>{
      if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch?.(()=>{});
      else document.exitFullscreen?.().catch?.(()=>{});
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
    window.FFRemote?.connect({
      isAdmin,
      onState: remoteState=>{
        consumeVisualEffects(remoteState);
        state=normalize(remoteState);
        tvSnapshotReady=true;
        try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){}
        render();
        playQueuedEffects();
      },
      onAuth: ()=>render(),
      onStatus: text=>{const indicator=document.getElementById('connection');if(indicator)indicator.textContent=text;}
    });
  }catch(e){gameMount.innerHTML=`<div class="waiting">Não foi possível iniciar: ${esc(e.message)}</div>`;console.error(e);}}
  start();
})();
