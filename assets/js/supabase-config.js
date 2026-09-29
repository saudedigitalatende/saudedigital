// Configuração pública e compartilhada do Supabase para todo o portal.
// A chave publishable/anon pode ser usada no navegador quando o RLS está ativo.
// NUNCA informe aqui service_role, secret key, senha ou credencial administrativa.
window.PORTAL_SUPABASE_CONFIG = Object.freeze({
  url: 'https://bbnswbmbenpwkcrsmhus.supabase.co',
  anonKey: 'sb_publishable_wQj1pP1DLTDC0Px1WzX_QQ_eystTvyq',
  allowedDomain: 'recife.pe.gov.br'
});
