(() => {
  'use strict';
  const guard=document.getElementById('guard'),app=document.getElementById('users-app'),body=document.getElementById('users-body');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db;
  function fail(message){guard.hidden=false;guard.textContent=message;guard.classList.add('error');app.hidden=true;}
  async function load(){
    const {data,error}=await db.from('catalogo_usuarios').select('*').order('nome');
    if(error)return fail(error.message);
    body.innerHTML=(data||[]).map(u=>`<tr data-id="${u.id}"><td><input data-k="nome" value="${esc(u.nome)}"></td><td>${esc(u.email)}</td><td><select data-k="perfil">${['ADMINISTRADOR','EDITOR','LEITOR'].map(p=>`<option ${p===u.perfil?'selected':''}>${p}</option>`).join('')}</select></td><td><select data-k="ativo"><option value="true" ${u.ativo?'selected':''}>Sim</option><option value="false" ${!u.ativo?'selected':''}>Não</option></select></td><td><button class="primary save-user">Salvar</button></td></tr>`).join('')||'<tr><td colspan="5">Nenhum registro encontrado.</td></tr>';
    guard.hidden=true;app.hidden=false;
  }
  async function handleAuth(detail){
    if(!detail?.user)return fail('Entre com uma conta autorizada.');
    if(detail.profile?.perfil!=='ADMINISTRADOR')return fail('Apenas administradores podem gerenciar usuários.');
    db=detail.client;guard.hidden=false;guard.classList.remove('error');guard.textContent='Carregando usuários e permissões…';app.hidden=true;await load();
  }
  window.addEventListener('portal-auth-change',event=>handleAuth(event.detail));
  body.addEventListener('click',async event=>{if(!event.target.classList.contains('save-user'))return;const row=event.target.closest('tr'),payload={};row.querySelectorAll('[data-k]').forEach(input=>payload[input.dataset.k]=input.dataset.k==='ativo'?input.value==='true':input.value);const {error}=await db.from('catalogo_usuarios').update(payload).eq('id',row.dataset.id);alert(error?error.message:'Usuário atualizado.');});
  if(window.PORTAL_AUTH_STATE)handleAuth(window.PORTAL_AUTH_STATE);
})();
