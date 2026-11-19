// ══════════════════════════════════════════════════════════════
//  COAUD — item "Pausas e Coberturas" na barra lateral (só DEV)
//  Inclua em qualquer página com sidebar:  <script src="coaud-menu-pausas.js" defer></script>
//  (ou cole este conteúdo no sidebar-init.js para valer em todas as páginas)
// ══════════════════════════════════════════════════════════════
(function () {
    const PERMITIDOS = ['dev'];          // quando liberar para mais gente: ['dev', 'supervisor']
    function permitido() {
        try { const u = JSON.parse(localStorage.getItem('usuarioLogado')) || {}; return PERMITIDOS.includes(String(u.permissao || '').toLowerCase()); }
        catch (e) { return false; }
    }
    function montar() {
        const nav = document.querySelector('.sidebar-nav');
        if (!nav) return;
        let a = document.getElementById('nav-pausas');
        if (!permitido()) { if (a) a.remove(); return; }
        if (!a) {
            a = document.createElement('a');
            a.className = 'nav-item'; a.id = 'nav-pausas'; a.href = 'index-pausas.html';
            a.innerHTML = '<span class="nav-icon">☕</span> Pausas e Coberturas';
            const inicio = [...nav.querySelectorAll('a.nav-item')].find(x => /(^|\/)index\.html$/.test(x.getAttribute('href') || ''));
            nav.insertBefore(a, inicio || null);
        }
        if (/index-pausas\.html$/.test(location.pathname)) a.classList.add('active');
    }
    window.COAUD_PAUSAS_PERMITIDOS = PERMITIDOS;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();