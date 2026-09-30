const fs=require('fs');
const html=fs.readFileSync('catalogo_de_servicos.html','utf8');
function object(name){const m=html.match(new RegExp(`const ${name} = (\\{.*?\\});\\r?\\n`));if(!m)throw new Error(`Objeto ${name} não encontrado`);return JSON.parse(m[1]);}
const sources=[['SISTEMAS','Sistemas',object('SISTEMAS')],['INFRA','Infraestrutura',object('INFRA')],['ADMINISTRATIVO','Administrativo',object('ADMINISTRATIVO')]];
const q=v=>v==null?'null':`'${String(v).replace(/'/g,"''")}'`;
const clean=v=>String(v||'').replace(/<br><span class='resp-group'>.*?<\/span>/g,'').replace(/&eacute;/g,'é').replace(/&atilde;/g,'ã').replace(/&ccedil;/g,'ç').trim();
const group=v=>{const m=String(v||'').match(/Grupo T(?:&eacute;|é)cnico:\s*(.*?)<\/span>/i);return m?clean(m[1]):''};
const base='https://saudedigitalatende.github.io/saudedigital/';
function docsFor(n){const d=[];const add=(tipo,path,nome)=>d.push({tipo,nome,url:path.startsWith('http')?path:base+path});
 if(n.includes('LOCUS'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_locus.html','POP - Sistema LOCUS');
 if(n.includes('TERRITÓRIO'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_esus_territorio.html','POP - E-SUS Território');
 if(n.includes('PEC E-SUS AB'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_pec_esus_ab.html','POP - PEC E-SUS AB');
 if(n.includes('SI- PNI')||n.includes('SI-PNI'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_si_pni.html','POP - SI-PNI');
 if(n.includes('CADSUS')){add('POP','documenta%C3%A7%C3%B5es/POP/pop_cadsus_web.html','POP - CADSUS Web');add('Manual','documenta%C3%A7%C3%B5es/Manual/manual_cadsus_web.html','Manual - CADSUS Web');add('Manual','documenta%C3%A7%C3%B5es/Manual/manual_sgop.html','Manual - SGOP')}
 if(n.includes('PEC MAC')){add('POP','documenta%C3%A7%C3%B5es/POP/pop_pec_mac_ipes.html','POP - PEC MAC IPES');add('Manual','documenta%C3%A7%C3%B5es/Manual/manual_pec_mac_ipes.html','Manual - PEC MAC IPES')}
 if(n.includes('INTEGRA'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_integra_ai.html','POP - Integra AI');if(n.includes('INFOSIS'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_infosis.html','POP - INFOSIS');
 if(n.includes('PRONTUÁRIO EM REDE (RES)'))add('Treinamento','https://drive.google.com/drive/folders/1-KZXI8hAql-zCKXzohH5KE6WS9WU__Kr','Treinamento - Prontuário em Rede (RES)');
 if(n.includes('RECIFE MONITORA')){add('POP','documenta%C3%A7%C3%B5es/POP/pop_recife_monitora.html','POP - Recife Monitora');add('POP','documenta%C3%A7%C3%B5es/POP/pop_recife_monitora_bloco_a.html','POP - Recife Monitora Bloco A')}
 if(n.includes('COLMEIA'))add('POP','documenta%C3%A7%C3%B5es/POP/pop_colmeia.html','POP - COLMEIA');if(n.includes('HOPCHAT')){add('POP','documenta%C3%A7%C3%B5es/POP/pop_hopchat.html','POP - HopChat');add('POP','documenta%C3%A7%C3%B5es/POP/pop_hopchat_notificacoes.html','POP - Notificações HopChat');add('POP','documenta%C3%A7%C3%B5es/POP/pop_resgatar_conversa_hopchat.html','POP - Resgatar Conversa HopChat')}
 if(n.includes('SEI')){add('POP','documenta%C3%A7%C3%B5es/POP/pop_sei.html','POP - SEI');add('POP','documenta%C3%A7%C3%B5es/POP/pop_guia_administracao_setorial.html','POP - Guia de Administração Setorial SEI');add('Processo','documenta%C3%A7%C3%B5es/Processos/processo_abertura_chamados_sei.html','Processo Operacional – Abertura de Chamados Relacionados ao SEI')}
 if(n.includes('TABLET'))add('Processo','documenta%C3%A7%C3%B5es/Processos/processo_entrega_garantia_devolucao_tablets_glpi.html','Processo Operacional – Atendimento Administrativo de Tablets no GLPI');
 if(n.includes('DESKTOP')||n.includes('NOTEBOOK')){add('Processo','documenta%C3%A7%C3%B5es/Processos/processo_abertura_chamados_ativos_glpi.html','Processo Operacional – Abertura de Chamados com Associação de Ativos no GLPI');add('Processo','documenta%C3%A7%C3%B5es/Processos/processo_dispositivos_passivos_glpi.html','Processo Operacional – Manutenção, Transferência e Liberação de Ativos e Dispositivos passivos no GLPI');add('Processo','documenta%C3%A7%C3%B5es/Processos/processo_substituicao_condenacao_ativos_glpi.html','Processo Operacional – Substituição e Condenação de Computadores e Notebooks no GLPI')}
 return d;}
let sql=`-- Gerado de catalogo_de_servicos.html. Execute após catalogo_admin.sql.\nbegin;\n`;
for(let ai=0;ai<sources.length;ai++){
 const [slug,areaName,data]=sources[ai];sql+=`insert into public.catalogo_areas(nome,slug,ordem) values(${q(areaName)},${q(slug.toLowerCase())},${ai}) on conflict(slug) do update set nome=excluded.nome,ordem=excluded.ordem;\n`;
 let ci=0;
 for(const [category,rows] of Object.entries(data)){
  sql+=`insert into public.catalogo_categorias(area_id,nome,ordem) select id,${q(category)},${ci++} from public.catalogo_areas where slug=${q(slug.toLowerCase())} on conflict(area_id,nome) do update set ordem=excluded.ordem;\n`;
  const by=new Map();for(const r of rows){if(!by.has(r.servico))by.set(r.servico,[]);by.get(r.servico).push(r)}
  let si=0;
  for(const [label,requests] of by){const m=label.match(/^\s*(\d+)\.\s*(.*)$/),num=m?Number(m[1]):null,name=m?m[2]:label,ownerRaw=requests[0].responsavel||requests[0].dono||'';
   sql+=`insert into public.catalogo_servicos(categoria_id,numero,nome,responsavel,grupo_tecnico,ordem) select c.id,${num??'null'},${q(name)},${q(clean(ownerRaw))},${q(group(ownerRaw))},${si++} from public.catalogo_categorias c join public.catalogo_areas a on a.id=c.area_id where a.slug=${q(slug.toLowerCase())} and c.nome=${q(category)} on conflict(categoria_id,nome) do update set numero=excluded.numero,responsavel=excluded.responsavel,grupo_tecnico=excluded.grupo_tecnico,ordem=excluded.ordem;\n`;
   sql+=`delete from public.catalogo_solicitacoes where servico_id=(select s.id from public.catalogo_servicos s join public.catalogo_categorias c on c.id=s.categoria_id join public.catalogo_areas a on a.id=c.area_id where a.slug=${q(slug.toLowerCase())} and c.nome=${q(category)} and s.nome=${q(name)});\n`;
   requests.forEach((r,i)=>sql+=`insert into public.catalogo_solicitacoes(servico_id,tipo,solicitacao,sla,n1,n2,n3,conceito,ordem) select s.id,${q(clean(r.tipo))},${q(clean(r.solicitacao))},${q(clean(r.sla))},${q(clean(r.n1))},${q(clean(r.n2))},${q(clean(r.n3))},${q(clean(r.descricao))},${i} from public.catalogo_servicos s join public.catalogo_categorias c on c.id=s.categoria_id join public.catalogo_areas a on a.id=c.area_id where a.slug=${q(slug.toLowerCase())} and c.nome=${q(category)} and s.nome=${q(name)};\n`);
   sql+=`delete from public.catalogo_documentos where servico_id=(select s.id from public.catalogo_servicos s join public.catalogo_categorias c on c.id=s.categoria_id join public.catalogo_areas a on a.id=c.area_id where a.slug=${q(slug.toLowerCase())} and c.nome=${q(category)} and s.nome=${q(name)}) and arquivo_path is null;\n`;
   docsFor(name).forEach((d,i)=>sql+=`insert into public.catalogo_documentos(servico_id,nome,tipo,url,ordem) select s.id,${q(d.nome)},${q(d.tipo)},${q(d.url)},${i} from public.catalogo_servicos s join public.catalogo_categorias c on c.id=s.categoria_id join public.catalogo_areas a on a.id=c.area_id where a.slug=${q(slug.toLowerCase())} and c.nome=${q(category)} and s.nome=${q(name)};\n`);
  }
 }
}
sql+='commit;\n';fs.writeFileSync('supabase/catalogo_seed.sql',sql);
console.log(`Seed gerado: ${sql.split('\n').length-1} comandos/linhas`);
