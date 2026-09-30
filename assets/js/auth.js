(() => {
  'use strict';

  if (window.__PORTAL_AUTH_STARTED__) return;
  window.__PORTAL_AUTH_STARTED__ = true;

  const config = window.PORTAL_SUPABASE_CONFIG || {};
  const configured = /^https:\/\//i.test(String(config.url || ''))
    && !String(config.url || '').startsWith('PREENCHA_')
    && Boolean(config.anonKey)
    && !String(config.anonKey || '').startsWith('PREENCHA_');
  const allowedDomain = String(config.allowedDomain || '').trim().toLowerCase();
  let client = null;
  let currentUser = null;
  let currentProfile = null;
  let lastFocusedElement = null;
  let authorizationCheck = 0;

  function createInterface() {
    const host = document.createElement('div');
    host.className = 'portal-auth-host';
    host.id = 'portal-auth-host';
    host.innerHTML = `
      <button type="button" class="portal-auth-trigger portal-auth-loading" id="portal-auth-entry" aria-haspopup="dialog" disabled>👤 Verificando acesso…</button>
      <div class="portal-auth-user" id="portal-auth-user" hidden>
        <button type="button" class="portal-auth-user-button" id="portal-auth-user-button" aria-haspopup="menu" aria-expanded="false">👤 <span id="portal-auth-user-name">Usuário</span> ▾</button>
        <div class="portal-auth-menu" id="portal-auth-menu" role="menu" hidden>
          <div class="portal-auth-summary"><strong id="portal-auth-menu-name"></strong><span id="portal-auth-menu-profile"></span></div>
          <button type="button" class="portal-auth-menu-item" id="portal-auth-admin" role="menuitem" hidden>⚙ Área administrativa</button>
          <button type="button" class="portal-auth-menu-item" id="portal-auth-users" role="menuitem" hidden>👥 Usuários e permissões</button>
          <button type="button" class="portal-auth-menu-item" id="portal-auth-account" role="menuitem">👤 Minha conta</button>
          <button type="button" class="portal-auth-menu-item" id="portal-auth-signout" role="menuitem">↪ Sair</button>
        </div>
      </div>`;

    const header = document.querySelector('header.hero, .hero, header');
    const actions = header?.querySelector('.hero-actions');
    if (actions) {
      host.classList.add('portal-auth-inline');
      actions.prepend(host);
    } else if (header) {
      header.classList.add('portal-auth-header-standalone');
      const computedPosition = window.getComputedStyle(header).position;
      if (computedPosition === 'static') header.style.position = 'relative';
      header.appendChild(host);
    } else {
      host.style.position = 'fixed';
      document.body.appendChild(host);
    }

    const overlay = document.createElement('div');
    overlay.className = 'portal-auth-modal-overlay';
    overlay.id = 'portal-auth-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="portal-auth-modal" role="dialog" aria-modal="true" aria-labelledby="portal-auth-title">
        <button type="button" class="portal-auth-close" id="portal-auth-close" aria-label="Fechar">×</button>
        <div class="portal-auth-view" id="portal-auth-login-view">
          <h2 id="portal-auth-title">Acesso ao Portal</h2>
          <p class="portal-auth-help">Acesso restrito a usuários autorizados.</p>
          <form id="portal-auth-form">
            <label class="portal-auth-label" for="portal-auth-email">E-mail institucional</label>
            <input class="portal-auth-input" id="portal-auth-email" name="email" type="email" autocomplete="email" required placeholder="nome@recife.pe.gov.br">
            <button class="portal-auth-submit" id="portal-auth-submit" type="submit">Enviar código de acesso</button>
            <p class="portal-auth-status" id="portal-auth-status" role="status" aria-live="polite"></p>
          </form>
        </div>
        <div class="portal-auth-view" id="portal-auth-account-view" hidden>
          <h2>Minha conta</h2>
          <p class="portal-auth-help">Dados da sessão autenticada.</p>
          <dl class="portal-auth-account"><dt>Nome</dt><dd id="portal-auth-account-name"></dd><dt>E-mail</dt><dd id="portal-auth-account-email"></dd><dt>Perfil</dt><dd id="portal-auth-account-profile"></dd></dl>
        </div>
      </section>`;
    document.body.appendChild(overlay);
  }

  createInterface();

  const elements = {
    entry: document.getElementById('portal-auth-entry'), user: document.getElementById('portal-auth-user'),
    userButton: document.getElementById('portal-auth-user-button'), userName: document.getElementById('portal-auth-user-name'),
    menu: document.getElementById('portal-auth-menu'), menuName: document.getElementById('portal-auth-menu-name'),
    menuProfile: document.getElementById('portal-auth-menu-profile'), admin: document.getElementById('portal-auth-admin'),
    users: document.getElementById('portal-auth-users'), account: document.getElementById('portal-auth-account'),
    signOut: document.getElementById('portal-auth-signout'), overlay: document.getElementById('portal-auth-overlay'),
    close: document.getElementById('portal-auth-close'), loginView: document.getElementById('portal-auth-login-view'),
    accountView: document.getElementById('portal-auth-account-view'), form: document.getElementById('portal-auth-form'),
    email: document.getElementById('portal-auth-email'), submit: document.getElementById('portal-auth-submit'),
    status: document.getElementById('portal-auth-status'), accountName: document.getElementById('portal-auth-account-name'),
    accountEmail: document.getElementById('portal-auth-account-email'), accountProfile: document.getElementById('portal-auth-account-profile')
  };

  function setStatus(message = '', type = '') {
    elements.status.textContent = message;
    elements.status.className = `portal-auth-status${type ? ` ${type}` : ''}`;
  }
  function emailHasAllowedDomain(email) {
    return !allowedDomain || String(email).toLowerCase().endsWith(`@${allowedDomain}`);
  }
  function closeMenu() {
    elements.menu.hidden = true;
    elements.userButton.setAttribute('aria-expanded', 'false');
  }
  function openModal(view = 'login') {
    lastFocusedElement = document.activeElement;
    elements.loginView.hidden = view !== 'login';
    elements.accountView.hidden = view !== 'account';
    if (view === 'account') {
      const email = String(currentUser?.email || '');
      elements.accountName.textContent = currentProfile?.nome || currentUser?.user_metadata?.nome || currentUser?.user_metadata?.full_name || email.split('@')[0] || 'Não informado';
      elements.accountEmail.textContent = email || 'Não informado';
      elements.accountProfile.textContent = currentProfile?.perfil || 'Sem permissão administrativa';
    }
    elements.overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => (view === 'login' ? elements.email : elements.close).focus());
  }
  function closeModal() {
    elements.overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }
  function renderSignedOut() {
    currentUser = null;
    currentProfile = null;
    elements.entry.disabled = false;
    elements.entry.classList.remove('portal-auth-loading');
    elements.entry.textContent = '👤 ENTRAR';
    elements.entry.hidden = false;
    elements.user.hidden = true;
    closeMenu();
    window.dispatchEvent(new CustomEvent('portal-auth-change', {detail: {user: null, profile: null, client}}));
  }
  function renderSignedIn(user, profile) {
    currentUser = user;
    currentProfile = profile;
    const email = String(user.email || '');
    const displayName = profile?.nome || user.user_metadata?.nome || user.user_metadata?.full_name || email.split('@')[0] || 'Usuário';
    const role = profile?.ativo ? profile.perfil : null;
    elements.userName.textContent = displayName;
    elements.menuName.textContent = displayName;
    elements.menuProfile.textContent = role ? `${role} · ${email}` : `Sem permissão administrativa · ${email}`;
    elements.admin.hidden = !['ADMINISTRADOR', 'EDITOR'].includes(role);
    elements.users.hidden = role !== 'ADMINISTRADOR';
    elements.entry.hidden = true;
    elements.user.hidden = false;
    window.dispatchEvent(new CustomEvent('portal-auth-change', {detail: {user, profile, client}}));
  }
  async function resolveSession(session) {
    const check = ++authorizationCheck;
    if (!session?.user) return renderSignedOut();
    const user = session.user;
    const email = String(user.email || '').toLowerCase();
    if (!emailHasAllowedDomain(email)) {
      await client.auth.signOut();
      renderSignedOut();
      setStatus(`Use seu e-mail institucional @${allowedDomain}.`, 'error');
      openModal('login');
      return;
    }
    const {data, error} = await client.from('catalogo_usuarios').select('id,user_id,email,nome,perfil,ativo,created_at').eq('user_id', user.id).maybeSingle();
    if (check !== authorizationCheck) return;
    const validProfile = !error && data && data.ativo && String(data.email || '').toLowerCase() === email ? data : null;
    renderSignedIn(user, validProfile);
    if (!elements.overlay.hidden) closeModal();
  }
  async function submitLogin(event) {
    event.preventDefault();
    const email = elements.email.value.trim().toLowerCase();
    setStatus();
    if (!emailHasAllowedDomain(email)) return setStatus(`Use seu e-mail institucional @${allowedDomain}.`, 'error');
    if (!configured || !client) return setStatus('A autenticação ainda não foi configurada. Informe a URL e a chave pública do Supabase.', 'error');
    elements.submit.disabled = true;
    try {
      sessionStorage.setItem('portal_auth_return_url', window.location.href.split('#')[0]);
      const redirectUrl = window.location.href.split('#')[0];
      const {error} = await client.auth.signInWithOtp({email, options: {emailRedirectTo: redirectUrl, shouldCreateUser: false}});
      if (error) throw error;
      setStatus('Código ou link de acesso enviado. Verifique seu e-mail institucional.', 'success');
    } catch (error) {
      console.error('Falha ao solicitar acesso ao portal:', error);
      setStatus('Não foi possível enviar o acesso. Confirme se o usuário foi previamente autorizado.', 'error');
    } finally { elements.submit.disabled = false; }
  }

  elements.entry.addEventListener('click', () => { setStatus(); openModal('login'); });
  elements.close.addEventListener('click', closeModal);
  elements.overlay.addEventListener('click', event => { if (event.target === elements.overlay) closeModal(); });
  elements.form.addEventListener('submit', submitLogin);
  elements.userButton.addEventListener('click', () => { const opening = elements.menu.hidden; elements.menu.hidden = !opening; elements.userButton.setAttribute('aria-expanded', String(opening)); });
  elements.account.addEventListener('click', () => { closeMenu(); openModal('account'); });
  const portalBase = window.location.pathname.includes('/saudedigital/') ? '/saudedigital/' : `${window.location.pathname.split('/').slice(0, -1).join('/')}/`;
  elements.admin.addEventListener('click', () => { window.location.href = `${portalBase}admin/`; });
  elements.users.addEventListener('click', () => { window.location.href = `${portalBase}admin/usuarios.html`; });
  elements.signOut.addEventListener('click', async () => { closeMenu(); if (client) await client.auth.signOut(); renderSignedOut(); });
  document.addEventListener('click', event => { if (!elements.user.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key !== 'Escape') return; if (!elements.overlay.hidden) closeModal(); else closeMenu(); });

  if (!configured || !window.supabase?.createClient) {
    renderSignedOut();
    return;
  }
  client = window.supabase.createClient(config.url, config.anonKey, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}});
  client.auth.getSession().then(({data, error}) => error ? renderSignedOut() : resolveSession(data.session));
  client.auth.onAuthStateChange((_event, session) => window.setTimeout(() => resolveSession(session), 0));
})();
