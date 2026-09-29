(() => {
  'use strict';

  const config = window.CATALOGO_SUPABASE_CONFIG || {};
  const configured = /^https:\/\//i.test(config.url || '')
    && !String(config.url || '').startsWith('PREENCHA_')
    && !String(config.anonKey || '').startsWith('PREENCHA_');
  const allowedDomain = String(config.allowedDomain || '').trim().toLowerCase();
  const elements = {
    entry: document.getElementById('auth-entry'),
    user: document.getElementById('auth-user'),
    userButton: document.getElementById('auth-user-button'),
    userName: document.getElementById('auth-user-name'),
    menu: document.getElementById('auth-user-menu'),
    menuName: document.getElementById('auth-menu-name'),
    menuProfile: document.getElementById('auth-menu-profile'),
    adminLink: document.getElementById('auth-admin-link'),
    accountLink: document.getElementById('auth-account-link'),
    signOut: document.getElementById('auth-signout'),
    overlay: document.getElementById('auth-overlay'),
    close: document.getElementById('auth-close'),
    loginView: document.getElementById('auth-login-view'),
    accountView: document.getElementById('auth-account-view'),
    form: document.getElementById('auth-form'),
    email: document.getElementById('auth-email'),
    submit: document.getElementById('auth-submit'),
    status: document.getElementById('auth-status'),
    accountName: document.getElementById('auth-account-name'),
    accountEmail: document.getElementById('auth-account-email'),
    accountProfile: document.getElementById('auth-account-profile')
  };

  let client = null;
  let authorizedProfile = null;
  let lastFocusedElement = null;
  let authorizationCheck = 0;

  function setStatus(message = '', type = '') {
    elements.status.textContent = message;
    elements.status.className = `auth-status${type ? ` ${type}` : ''}`;
  }

  function showLogin() {
    elements.loginView.hidden = false;
    elements.accountView.hidden = true;
  }

  function showAccount() {
    if (!authorizedProfile) return;
    elements.accountName.textContent = authorizedProfile.nome || 'Não informado';
    elements.accountEmail.textContent = authorizedProfile.email;
    elements.accountProfile.textContent = authorizedProfile.perfil;
    elements.loginView.hidden = true;
    elements.accountView.hidden = false;
  }

  function openModal(view = 'login') {
    lastFocusedElement = document.activeElement;
    if (view === 'account') showAccount();
    else showLogin();
    elements.overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => (view === 'account' ? elements.close : elements.email).focus());
  }

  function closeModal() {
    elements.overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  function closeMenu() {
    elements.menu.hidden = true;
    elements.userButton.setAttribute('aria-expanded', 'false');
  }

  function renderSignedOut() {
    authorizedProfile = null;
    elements.entry.hidden = false;
    elements.user.hidden = true;
    closeMenu();
  }

  function renderSignedIn(profile) {
    authorizedProfile = profile;
    const displayName = profile.nome || profile.email.split('@')[0];
    elements.userName.textContent = displayName;
    elements.menuName.textContent = displayName;
    elements.menuProfile.textContent = `${profile.perfil} · ${profile.email}`;
    elements.adminLink.hidden = !['ADMINISTRADOR', 'EDITOR'].includes(profile.perfil);
    elements.entry.hidden = true;
    elements.user.hidden = false;
  }

  function emailHasAllowedDomain(email) {
    if (!allowedDomain) return true;
    return email.toLowerCase().endsWith(`@${allowedDomain}`);
  }

  async function authorizeSession(session) {
    const check = ++authorizationCheck;
    if (!session?.user) {
      renderSignedOut();
      return;
    }

    const userEmail = String(session.user.email || '').toLowerCase();
    if (!emailHasAllowedDomain(userEmail)) {
      await client.auth.signOut();
      setStatus('Este e-mail não pertence ao domínio institucional permitido.', 'error');
      openModal('login');
      return;
    }

    const {data, error} = await client
      .from('catalogo_usuarios')
      .select('id,user_id,email,nome,perfil,ativo,created_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (check !== authorizationCheck) return;
    const profileEmail = String(data?.email || '').toLowerCase();
    if (error || !data || !data.ativo || profileEmail !== userEmail) {
      await client.auth.signOut();
      renderSignedOut();
      setStatus('Usuário não autorizado, inativo ou sem permissão para esta área.', 'error');
      openModal('login');
      return;
    }

    renderSignedIn(data);
    if (!elements.overlay.hidden) closeModal();
  }

  async function submitLogin(event) {
    event.preventDefault();
    const email = elements.email.value.trim().toLowerCase();
    setStatus();

    if (!emailHasAllowedDomain(email)) {
      setStatus(`Use seu e-mail institucional @${allowedDomain}.`, 'error');
      return;
    }
    if (!configured || !client) {
      setStatus('A autenticação ainda não foi configurada. Preencha a URL e a chave pública do Supabase.', 'error');
      return;
    }

    elements.submit.disabled = true;
    try {
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const {error} = await client.auth.signInWithOtp({
        email,
        options: {emailRedirectTo: redirectUrl, shouldCreateUser: false}
      });
      if (error) throw error;
      setStatus('Código ou link de acesso enviado. Verifique seu e-mail institucional.', 'success');
    } catch (error) {
      console.error('Falha ao solicitar acesso ao catálogo:', error);
      setStatus('Não foi possível enviar o acesso. Confirme se o usuário foi previamente autorizado.', 'error');
    } finally {
      elements.submit.disabled = false;
    }
  }

  elements.entry.addEventListener('click', () => {
    setStatus();
    openModal('login');
  });
  elements.close.addEventListener('click', closeModal);
  elements.overlay.addEventListener('click', event => {
    if (event.target === elements.overlay) closeModal();
  });
  elements.form.addEventListener('submit', submitLogin);
  elements.userButton.addEventListener('click', () => {
    const opening = elements.menu.hidden;
    elements.menu.hidden = !opening;
    elements.userButton.setAttribute('aria-expanded', String(opening));
  });
  elements.accountLink.addEventListener('click', () => {
    closeMenu();
    openModal('account');
  });
  elements.adminLink.addEventListener('click', event => event.preventDefault());
  elements.signOut.addEventListener('click', async () => {
    closeMenu();
    if (client) await client.auth.signOut();
    renderSignedOut();
  });
  document.addEventListener('click', event => {
    if (!elements.user.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!elements.overlay.hidden) closeModal();
    else closeMenu();
  });

  renderSignedOut();
  if (!configured || !window.supabase?.createClient) return;

  client = window.supabase.createClient(config.url, config.anonKey, {
    auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
  });
  client.auth.getSession().then(({data}) => authorizeSession(data.session));
  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => authorizeSession(session), 0);
  });
})();
