/* Supabase Realtime bridge: audience read-only, presenter writes after RLS authorization. */
(() => {
  'use strict';
  const client = window.supabase?.createClient?.(
    'https://fngsiatxhqkodcdmdxre.supabase.co',
    'sb_publishable_Op4Ywr4x0dlQGphFR0FcfQ_XAYaxPj2',
    { auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} }
  );
  let isAdmin=false, authorized=false, version=0, pending=0, pin='';
  let queue=Promise.resolve(), onState=()=>{}, onAuth=()=>{}, onStatus=()=>{};
  let message='Digite o PIN de 6 dígitos do apresentador.';
  function status(s){onStatus(s);}
  async function load(){
    if(!client)throw new Error('Biblioteca Supabase não carregou');
    const {data,error}=await client.from('game_live_state').select('payload,version').eq('id','main').single();
    if(error)throw error;
    version=Number(data.version)||0;
    if(!pending && data.payload && Object.keys(data.payload).length)onState(data.payload);
  }
  async function requestHost(data){
    const response=await fetch('https://fngsiatxhqkodcdmdxre.supabase.co/functions/v1/family-feud-host',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||'Não foi possível validar o PIN');
    return result;
  }
  async function connect(config){
    isAdmin=config.isAdmin;onState=config.onState;onAuth=config.onAuth;onStatus=config.onStatus;
    if(!client){status('Sem biblioteca Realtime');return;}
    try{
      await load();
      client.channel('family-feud-live').on('postgres_changes',{
        event:'UPDATE',schema:'public',table:'game_live_state',filter:'id=eq.main'
      }, ({new:record})=>{
        if(Number(record.version)<=version)return;
        version=Number(record.version);
        if(!pending && record.payload && Object.keys(record.payload).length)onState(record.payload);
        status('Sincronizado');
      }).subscribe(s=>status(s==='SUBSCRIBED'?'TV conectada':s==='CHANNEL_ERROR'?'Conexão interrompida':'Conectando…'));
      if(isAdmin){
        const cached=sessionStorage.getItem('ff-host-pin');
        if(cached){
          try{await requestHost({action:'verify',pin:cached});pin=cached;authorized=true;}
          catch(e){sessionStorage.removeItem('ff-host-pin');message='PIN inválido. Tente novamente.';}
        }
        onAuth();
      }
    }catch(e){console.error('Supabase',e);status('Falha de conexão remota');}
  }
  function publish(state){
    if(!client||!authorized)return;
    const snapshot=JSON.parse(JSON.stringify(state));
    pending++;
    queue=queue.catch(()=>{}).then(async()=>{
      const result=await requestHost({action:'publish',pin,state:snapshot,version});
      version=Number(result.version);
      status('Sincronizado');
    }).catch(async e=>{
      console.error('Falha ao publicar partida',e);
      status('Erro ao salvar');
      message='A ação não foi sincronizada. Confira a internet e recarregue.';
      try{await load();}catch(err){console.warn(err);}
      onAuth();
    }).finally(()=>{pending--;});
  }
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderLogin(mount){
    mount.innerHTML='<h2>PIN do apresentador</h2><p class="muted-text">'+escape(message)+'</p>'+
      '<form id="remote-login"><label>PIN de 6 dígitos<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" required></label>'+
      '<div class="button-row"><button class="button primary full" type="submit">Entrar no painel</button></div></form>';
  }
  async function handleSubmit(event){
    if(event.target.id!=='remote-login')return;
    event.preventDefault();
    const value=event.target.elements.pin.value.trim();
    try{await requestHost({action:'verify',pin:value});pin=value;authorized=true;sessionStorage.setItem('ff-host-pin',value);onAuth();}
    catch(e){message=e.message||'PIN incorreto';onAuth();}
  }
  function logout(){pin='';authorized=false;sessionStorage.removeItem('ff-host-pin');onAuth();}
  window.FFRemote={connect,publish,renderLogin,handleSubmit,logout,canControl:()=>authorized,available:()=>!!client};
})();