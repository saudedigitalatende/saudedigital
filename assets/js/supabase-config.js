// Configuração pública e compartilhada do Supabase para todo o portal.
// A chave publishable/anon pode ser usada no navegador quando o RLS está ativo.
// NUNCA informe aqui service_role, secret key, senha ou credencial administrativa.
window.PORTAL_SUPABASE_CONFIG = Object.freeze({
  url: 'PREENCHA_COM_A_URL_DO_PROJETO',
  anonKey: 'PREENCHA_COM_A_CHAVE_PUBLICA_ANON',
  allowedDomain: 'recife.pe.gov.br'
});
