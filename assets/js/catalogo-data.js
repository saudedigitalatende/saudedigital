(() => {
  'use strict';
  const config=window.PORTAL_SUPABASE_CONFIG||{};
  if(!window.supabase?.createClient||!/^https:\/\//.test(config.url||''))return;
  const db=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const ownerHtml=s=>{const owner=s.responsavel||'',group=s.grupo_tecnico||'';return `${owner}${group?`<br><span class='resp-group'>Grupo T&eacute;cnico: ${group}</span>`:''}`};
  async function load(){
    const {data,error}=await db.from('catalogo_areas').select('slug,nome,ordem,ativo,catalogo_categorias(id,nome,ordem,ativo,catalogo_servicos(id,numero,nome,responsavel,grupo_tecnico,icone,ordem,ativo,catalogo_solicitacoes(id,tipo,solicitacao,sla,n1,n2,n3,conceito,ordem,ativo),catalogo_documentos(id,nome,tipo,versao,url,arquivo_path,ordem,ativo)))').eq('ativo',true).order('ordem');
    if(error||!data){console.info('Catálogo: mantendo dados incorporados até a migração do Supabase.',error?.message||'sem resposta');return;}
    const target={sistemas:{},infra:{},administrativo:{}};window.CATALOGO_DB_DOCUMENTS={};window.CATALOGO_DB_SERVICE_IDS={};
    data.forEach(area=>(area.catalogo_categorias||[]).filter(cat=>cat.ativo!==false).sort((a,b)=>a.ordem-b.ordem).forEach(cat=>{
      const rows=[];(cat.catalogo_servicos||[]).filter(service=>service.ativo!==false).sort((a,b)=>a.ordem-b.ordem).forEach(service=>{
        const label=`${service.numero?`${service.numero}. `:''}${service.nome}`;const owner=ownerHtml(service);window.CATALOGO_DB_SERVICE_IDS[label]=service.id;
        (service.catalogo_solicitacoes||[]).filter(r=>r.ativo!==false).sort((a,b)=>a.ordem-b.ordem).forEach(r=>rows.push({_id:r.id,servico:label,responsavel:owner,dono:owner,tipo:r.tipo,solicitacao:r.solicitacao,sla:r.sla,n1:r.n1,n2:r.n2,n3:r.n3,descricao:r.conceito}));
        window.CATALOGO_DB_DOCUMENTS[label]=(service.catalogo_documentos||[]).filter(d=>d.ativo!==false).sort((a,b)=>a.ordem-b.ordem).map(d=>[String(d.tipo||'documento').toLowerCase(),d.url,d.nome,d.versao,d.id]);
      });if(target[area.slug])target[area.slug][cat.nome]=rows;
    }));
    SISTEMAS=target.sistemas;INFRA=target.infra;ADMINISTRATIVO=target.administrativo;
    ['sistemas','infra','adm'].forEach(area=>{buildSubTabs(area);buildCatalog(area)});
    document.documentElement.dataset.catalogSource='supabase';
    window.dispatchEvent(new CustomEvent('catalog-data-ready'));
  }
  load().catch(error=>console.error('Falha ao carregar catálogo do Supabase; usando cópia incorporada.',error));
})();
