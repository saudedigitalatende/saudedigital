(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let db, profile, areas=[], categories=[], services=[];
  const state = {requests:[], documents:[]};
  const guard=$('guard'), app=$('app'), dialog=$('service-dialog');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function fail(message){guard.textContent=message;guard.classList.add('error');app.hidden=true;}
  async function queryCatalog(){
    const [a,c,s]=await Promise.all([
      db.from('catalogo_areas').select('*').order('ordem'),
      db.from('catalogo_categorias').select('*').order('ordem'),
      db.from('catalogo_servicos').select('*,catalogo_solicitacoes(*),catalogo_documentos(*)').order('ordem')
    ]);
    if(a.error||c.error||s.error) throw a.error||c.error||s.error;
    areas=a.data||[];categories=c.data||[];services=s.data||[];renderAll();
  }
  function renderAll(){
    $('stats').innerHTML=[['Áreas',areas.length],['Categorias',categories.length],['Serviços',services.length],['Ativos',services.filter(s=>s.ativo).length]].map(x=>`<div class="stat"><strong>${x[1]}</strong>${x[0]}</div>`).join('');
    const areaOptions=areas.map(a=>`<option value="${a.id}">${esc(a.nome)}</option>`).join('');
    $('area-filter').innerHTML='<option value="">Todas as áreas</option>'+areaOptions;
    $('service-area').innerHTML='<option value="">Selecione</option>'+areaOptions;
    refreshCategoryOptions();renderServices();loadHistory();
  }
  function refreshCategoryOptions(selected=''){
    const area=$('service-area').value;
    const list=categories.filter(c=>!area||c.area_id===area);
    $('service-category').innerHTML='<option value="">Selecione</option>'+list.map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${esc(c.nome)}</option>`).join('');
    const filterArea=$('area-filter').value;
    $('category-filter').innerHTML='<option value="">Todas as categorias</option>'+categories.filter(c=>!filterArea||c.area_id===filterArea).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  }
  function renderServices(){
    const text=$('search').value.toLowerCase(), areaId=$('area-filter').value, catId=$('category-filter').value;
    $('services-body').innerHTML=services.filter(s=>{
      const cat=categories.find(c=>c.id===s.categoria_id);return(!text||`${s.numero||''} ${s.nome} ${s.responsavel||''}`.toLowerCase().includes(text))&&(!areaId||cat?.area_id===areaId)&&(!catId||s.categoria_id===catId);
    }).map(s=>{const cat=categories.find(c=>c.id===s.categoria_id);return `<tr><td><strong>${s.numero?`${s.numero}. `:''}${esc(s.nome)}</strong></td><td>${esc(cat?.nome||'—')}</td><td>${esc(s.responsavel||'—')}</td><td>${esc(s.grupo_tecnico||'—')}</td><td>${(s.catalogo_solicitacoes||[]).length}</td><td><span class="badge ${s.ativo?'':'off'}">${s.ativo?'Ativo':'Inativo'}</span></td><td><button class="secondary edit" data-id="${s.id}">Editar</button> <button class="danger toggle" data-id="${s.id}">${s.ativo?'Inativar':'Ativar'}</button></td></tr>`}).join('')||'<tr><td colspan="7">Nenhum serviço encontrado.</td></tr>';
  }
  function requestRow(r={}){return `<div class="request-row" data-id="${r.id||''}"><input data-k="tipo" placeholder="Tipo" value="${esc(r.tipo)}"><input data-k="solicitacao" placeholder="Solicitação" value="${esc(r.solicitacao)}"><input data-k="sla" placeholder="SLA" value="${esc(r.sla)}"><input data-k="n1" placeholder="N1" value="${esc(r.n1)}"><input data-k="n2" placeholder="N2" value="${esc(r.n2)}"><input data-k="n3" placeholder="N3" value="${esc(r.n3)}"><input data-k="conceito" placeholder="Conceito" value="${esc(r.conceito)}"><button type="button" class="row-remove">×</button></div>`;}
  function documentRow(d={}){return `<div class="document-row" data-id="${d.id||''}" data-path="${esc(d.arquivo_path)}"><input data-k="nome" placeholder="Nome" value="${esc(d.nome)}"><input data-k="tipo" placeholder="Tipo" value="${esc(d.tipo)}"><input data-k="versao" placeholder="Versão" value="${esc(d.versao)}"><input data-k="url" placeholder="URL" value="${esc(d.url)}"><input data-k="file" type="file"><button type="button" class="row-remove">×</button></div>`;}
  function openForm(service){
    $('service-form').reset();$('service-id').value=service?.id||'';$('form-title').textContent=service?'Editar serviço':'Novo serviço';
    $('service-name').value=service?.nome||'';$('service-number').value=service?.numero||'';$('service-owner').value=service?.responsavel||'';$('service-group').value=service?.grupo_tecnico||'';$('service-icon').value=service?.icone||'';$('service-active').value=String(service?.ativo??true);
    const cat=categories.find(c=>c.id===service?.categoria_id);$('service-area').value=cat?.area_id||areas[0]?.id||'';refreshCategoryOptions(service?.categoria_id||'');
    $('requests-editor').innerHTML=(service?.catalogo_solicitacoes||[]).sort((a,b)=>a.ordem-b.ordem).map(requestRow).join('');
    $('documents-editor').innerHTML=(service?.catalogo_documentos||[]).sort((a,b)=>a.ordem-b.ordem).map(documentRow).join('');$('form-status').textContent='';dialog.showModal();
  }
  function readRows(selector){return [...document.querySelectorAll(selector)].map((row,ordem)=>{const out={id:row.dataset.id||null,ordem};row.querySelectorAll('[data-k]').forEach(i=>{if(i.dataset.k!=='file')out[i.dataset.k]=i.value.trim()});return out});}
  async function save(event){
    event.preventDefault();const button=$('save-service');button.disabled=true;$('form-status').textContent='Salvando…';
    try{
      const payload={categoria_id:$('service-category').value,numero:Number($('service-number').value)||null,nome:$('service-name').value.trim(),responsavel:$('service-owner').value.trim(),grupo_tecnico:$('service-group').value.trim(),icone:$('service-icon').value.trim(),ativo:$('service-active').value==='true',ordem:Number($('service-number').value)||0};
      let serviceId=$('service-id').value;
      const result=serviceId?await db.from('catalogo_servicos').update(payload).eq('id',serviceId).select().single():await db.from('catalogo_servicos').insert(payload).select().single();if(result.error)throw result.error;serviceId=result.data.id;
      const old=services.find(s=>s.id===serviceId);const reqs=readRows('#requests-editor .request-row');const docs=readRows('#documents-editor .document-row');
      const keptReq=reqs.filter(r=>r.id).map(r=>r.id), keptDoc=docs.filter(d=>d.id).map(d=>d.id);
      for(const r of old?.catalogo_solicitacoes||[])if(!keptReq.includes(r.id))await db.from('catalogo_solicitacoes').delete().eq('id',r.id);
      for(const d of old?.catalogo_documentos||[])if(!keptDoc.includes(d.id)){if(d.arquivo_path)await db.storage.from('catalogo-documentos').remove([d.arquivo_path]);await db.from('catalogo_documentos').delete().eq('id',d.id)}
      for(const r of reqs){const {id,...data}=r;data.servico_id=serviceId;data.ativo=true;const q=id?db.from('catalogo_solicitacoes').update(data).eq('id',id):db.from('catalogo_solicitacoes').insert(data);const x=await q;if(x.error)throw x.error}
      const docRows=[...document.querySelectorAll('#documents-editor .document-row')];
      for(let i=0;i<docs.length;i++){const d=docs[i], row=docRows[i], file=row.querySelector('[data-k=file]').files[0];let path=row.dataset.path||null,url=d.url||null;if(file){path=`${serviceId}/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi,'_')}`;const up=await db.storage.from('catalogo-documentos').upload(path,file,{upsert:false});if(up.error)throw up.error;url=db.storage.from('catalogo-documentos').getPublicUrl(path).data.publicUrl}const {id,...data}=d;Object.assign(data,{servico_id:serviceId,arquivo_path:path,url,ativo:true});const q=id?db.from('catalogo_documentos').update(data).eq('id',id):db.from('catalogo_documentos').insert(data);const x=await q;if(x.error)throw x.error}
      dialog.close();await queryCatalog();
    }catch(error){console.error(error);$('form-status').textContent=`Não foi possível salvar: ${error.message||error}`;}finally{button.disabled=false}
  }
  async function loadHistory(){const {data}=await db.from('catalogo_historico').select('*').order('data_hora',{ascending:false}).limit(50);$('history-list').innerHTML=(data||[]).map(h=>`<div class="history-item"><strong>${esc(h.usuario_email||'Sistema')}</strong> ${esc(h.acao.toLowerCase())} ${esc(h.entidade)}<br><small>${new Date(h.data_hora).toLocaleString('pt-BR')}</small></div>`).join('')||'<div class="history-item">Nenhuma alteração registrada.</div>'}
  window.addEventListener('portal-auth-change',async e=>{const d=e.detail;if(!d.user)return fail('Entre com uma conta autorizada para acessar esta página.');if(!d.profile||!['ADMINISTRADOR','EDITOR'].includes(d.profile.perfil))return fail('Seu perfil não possui permissão para alterar o catálogo.');db=d.client;profile=d.profile;$('nav-users').hidden=profile.perfil!=='ADMINISTRADOR';guard.hidden=true;app.hidden=false;try{await queryCatalog()}catch(error){fail(`A estrutura administrativa ainda não está disponível no Supabase: ${error.message}`)}});
  $('search').addEventListener('input',renderServices);$('area-filter').addEventListener('change',()=>{refreshCategoryOptions();renderServices()});$('category-filter').addEventListener('change',renderServices);$('service-area').addEventListener('change',()=>refreshCategoryOptions());$('new-service').addEventListener('click',()=>openForm());$('add-request').addEventListener('click',()=>$('requests-editor').insertAdjacentHTML('beforeend',requestRow()));$('add-document').addEventListener('click',()=>$('documents-editor').insertAdjacentHTML('beforeend',documentRow()));$('service-form').addEventListener('submit',save);
  $('edit-category').addEventListener('click',async()=>{const id=$('category-filter').value;if(!id)return alert('Selecione uma categoria específica.');const current=categories.find(c=>c.id===id),nome=prompt('Novo nome da categoria:',current.nome);if(!nome||nome.trim()===current.nome)return;const {error}=await db.from('catalogo_categorias').update({nome:nome.trim()}).eq('id',id);if(error)alert(error.message);else await queryCatalog()});
  document.addEventListener('click',async e=>{const edit=e.target.closest('.edit'),toggle=e.target.closest('.toggle'),remove=e.target.closest('.row-remove');if(remove)remove.parentElement.remove();if(edit)openForm(services.find(s=>s.id===edit.dataset.id));if(toggle){const s=services.find(x=>x.id===toggle.dataset.id);if(s&&confirm(`${s.ativo?'Inativar':'Ativar'} ${s.nome}?`)){const {error}=await db.from('catalogo_servicos').update({ativo:!s.ativo}).eq('id',s.id);if(error)alert(error.message);else await queryCatalog()}}});
})();
