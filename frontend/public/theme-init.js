/*
 * Aplica o tema ANTES da primeira pintura, evitando o lampejo claro em celulares/redes lentas.
 * É um arquivo externo (e síncrono) porque a CSP do Nginx usa script-src 'self' e bloquearia script inline.
 *
 * CAMPANHA (Black Friday): com FORCE_DARK_CATALOG = true o catálogo público (/catalogo) abre sempre
 * escuro, sem alterar a preferência salva do usuário. Para ENCERRAR a campanha, mude para false
 * (este é o único lugar: o React lê este valor em window.__FORCE_DARK_CATALOG__).
 */
(function () {
  var FORCE_DARK_CATALOG = true;
  window.__FORCE_DARK_CATALOG__ = FORCE_DARK_CATALOG;
  try {
    var root = document.documentElement;
    if (FORCE_DARK_CATALOG && location.pathname.indexOf('/catalogo') === 0) {
      root.classList.add('dark');
    } else if (localStorage.getItem('hesed-theme') === 'dark') {
      root.classList.add('dark');
    }
  } catch (e) {
    /* localStorage indisponível: o React aplica o tema ao montar */
  }
})();
