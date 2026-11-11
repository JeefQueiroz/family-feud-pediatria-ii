/* Supabase Realtime bridge: audience read-only, presenter writes after RLS authorization. */
(() => {
  'use strict';
  const client = window.supabase?.createClient?.(
    'https://fngsiatxhqkodcdmdxre.supabase.co',
    'sb_publishable_Op4Ywr4x0dlQGphFR0FcfQ_XAYaxPj2',
    { auth: {persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} }
  );
  let isAdmin=false, authorized=false, version=0, pending=0;
  let queue=Promise.resolve(), onState=()=>{}, onAuth=()=>{}, onStatus=()=>{};
  let message='Entre com uma conta autorizada para controlar o jogo.';
  function status(s){onStatus(s);}
  async function load(){
    if(!client)throw new Error('Biblioteca Supabase não carregou');
    const {data,error}=await client.from('game_live_state').select('payload,version').eq('id','main').single();
    if(error)throw error;
    version=Number(data.version)||0;
    if(!pending && data.payload && Object.keys(data.payload).length)onState(data.payload);
  }
  async function checkHost(){
    if(!client || !isAdmin)return;
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user){authorized=false;message='Entre com uma conta autorizada para controlar a TV.';onAuth();return;}
    const access=await client.from('game_hosts').select('user_id').eq('user_id',user.id).maybeSingle();
    authorized=!!access.data && !access.error;
    message=authorized?'Apresentador autorizado.':'Conta autenticada, mas ainda sem permissão de apresentador. Autorize o usuário no Supabase.';
    onAuth();
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
        client.auth.onAuthStateChange(()=>setTimeout(()=>checkHost().catch(console.error),0));
        await checkHost();
      }
    }catch(e){console.error('Supabase',e);status('Falha de conexão remota');}
  }
  function publish(state){
    if(!client||!authorized)return;
    const snapshot=JSON.parse(JSON.stringify(state));
    pending++;
    queue=queue.catch(()=>{}).then(async()=>{
      const {data,error}=await client.from('game_live_state')
        .update({payload:snapshot,version:version+1,updated_at:new Date().toISOString()})
        .eq('id','main').eq('version',version).select('version');
      if(error||!data?.length)throw error||new Error('Conflito de atualização');
      version=Number(data[0].version);
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
    mount.innerHTML='<h2>Acesso do apresentador</h2><p class="muted-text">'+escape(message)+'</p>'+
      '<form id="remote-login"><label>E-mail<input name="email" type="email" autocomplete="email" required></label>'+
      '<label>Senha<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>'+
      '<div class="button-row"><button class="button primary" type="submit" data-auth="login">Entrar</button>'+
      '<button class="button secondary" type="submit" data-auth="signup">Criar conta</button></div></form>'+
      '<div class="button-row"><button class="button secondary" data-auth-logout type="button">Sair da conta</button></div>'+
      '<p class="privacy-note">O cadastro não concede acesso automaticamente. O proprietário deve autorizar o usuário em game_hosts. A TV só recebe dados; não pode alterar a partida.</p>';
  }
  async function handleSubmit(event){
    if(event.target.id!=='remote-login'||!client)return;
    event.preventDefault();
    const email=event.target.elements.email.value.trim(),password=event.target.elements.password.value;
    const signup=event.submitter?.dataset.auth==='signup';
    message='Autenticando…';onAuth();
    try{
      const result=signup?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      await checkHost();
      if(signup && !authorized){message='Cadastro enviado. Confirme o e-mail, quando solicitado, e autorize o usuário no Supabase.';onAuth();}
    }catch(e){message=e.message||'Falha na autenticação';onAuth();}
  }
  async function logout(){if(!client)return;await client.auth.signOut();authorized=false;onAuth();}
  window.FFRemote={connect,publish,renderLogin,handleSubmit,logout,canControl:()=>authorized,available:()=>!!client};
})();