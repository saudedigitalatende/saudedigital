// Configuração pública do Supabase para o Catálogo de Serviços.
// A chave publishable/anon é própria para uso no navegador e continua protegida pelas políticas RLS.
// NUNCA informe aqui service_role, secret key, senha do banco ou qualquer credencial privada.
window.CATALOGO_SUPABASE_CONFIG = Object.freeze({
  url: 'PREENCHA_COM_A_URL_DO_PROJETO',
  anonKey: 'PREENCHA_COM_A_CHAVE_PUBLICA_ANON',
  allowedDomain: 'recife.pe.gov.br'
});
