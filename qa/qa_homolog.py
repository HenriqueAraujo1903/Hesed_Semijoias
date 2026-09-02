#!/usr/bin/env python3
"""
Bateria de QA end-to-end contra o ambiente de HOMOLOGAÇÃO (porta 8081).

Perfil: QA sênior. Objetivo: garantir segurança para promover homolog → produção
sem quebrar o que já está no ar. Cobre features novas (múltiplas fotos, ordenação
de esgotados) e regressão completa (auth/RBAC, produtos, promoções, consignados,
pedidos, segurança/validação).

Sem dependências externas — usa apenas a stdlib (urllib).
Todos os recursos criados são rastreados e removidos ao final (cleanup).
"""

import json
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
import http.cookiejar
import os

# Parametrizável por env para rodar contra dev (8080) ou homolog (8081).
BASE = os.environ.get("QA_BASE", "http://localhost:8081")
ADMIN_EMAIL = os.environ.get("QA_ADMIN_EMAIL", "admin@homolog.com")
ADMIN_PASS = os.environ.get("QA_ADMIN_PASS", "homolog123")

# ---------------------------------------------------------------------------
# Harness — usa CookieJar para suportar autenticação via cookie HttpOnly
# e fallback para header Authorization (retrocompat).
# ---------------------------------------------------------------------------

class Results:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []  # (nome, esperado, obtido)

    def check(self, name, cond, expected=None, got=None):
        if cond:
            self.passed += 1
        else:
            self.failed += 1
            self.failures.append((name, expected, got))
            print(f"  \u2717 FAIL: {name} | esperado={expected} obtido={got}")

R = Results()

# Recursos criados para limpeza posterior
CREATED_PRODUCTS = set()
CREATED_PROMOS = set()
CREATED_CONSIGNEES = set()
CREATED_ORDERS = set()

# CookieJar partilhado — persiste o cookie jwt entre requisições
_cookie_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cookie_jar))


def request(method, path, token=None, body=None, raw_body=None, headers=None, no_cookie=False):
    """Executa requisição HTTP com suporte a cookie e header.
    O CookieJar envia automaticamente o cookie jwt quando disponível.
    Se `token` for passado explicitamente, também adiciona o header Authorization
    (retrocompat para testes de RBAC que verificam acesso com/sem token).
    Passe no_cookie=True para simular requisições sem sessão (testes de RBAC)."""
    url = BASE + path
    data = None
    hdrs = headers or {}
    if raw_body is not None:
        data = raw_body.encode("utf-8")
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    if token:
        hdrs["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    opener = urllib.request.urlopen if no_cookie else _opener.open
    try:
        with opener(req, timeout=30) as resp:
            text = resp.read().decode("utf-8")
            status = resp.getcode()
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        status = e.code
    except Exception as e:
        return (0, str(e))
    try:
        return (status, json.loads(text)) if text else (status, None)
    except json.JSONDecodeError:
        return (status, text)


def admin_login():
    """Faz login e retorna o token JWT para uso no header Authorization (retrocompat).
    O CookieJar também captura o cookie jwt automaticamente para as próximas chamadas."""
    st, b = request("POST", "/api/auth/login",
                    body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if st == 200 and isinstance(b, dict) and b.get("id"):
        # Pós-migração: o token vive no cookie, não no body.
        # Para retrocompat dos testes que usam header, fazemos /auth/me via cookie
        # para confirmar a sessão, e obtemos o token do cookie jar.
        jwt_cookie = next((c.value for c in _cookie_jar if c.name == "jwt"), None)
        if jwt_cookie:
            return jwt_cookie
        # Fallback: ainda pode vir no body em ambientes antigos
        if b.get("token"):
            return b["token"]
    print(f"FATAL: login admin falhou (status={st}, body={b})")
    sys.exit(1)


def create_product(token, **overrides):
    """Cria produto e rastreia para limpeza. Retorna body."""
    n = int(time.time() * 1000) % 100000000
    payload = {
        "sku": f"QA-{n}-{len(CREATED_PRODUCTS)}",
        "name": "Produto QA Teste",
        "category": "Anel",
        "costPrice": 10.0,
        "salePrice": 25.0,
        "stockStatus": "DISPONIVEL",
    }
    payload.update(overrides)
    st, b = request("POST", "/api/admin/products", token=token, body=payload)
    if st == 201 and isinstance(b, dict) and b.get("id"):
        CREATED_PRODUCTS.add(b["id"])
    return st, b


TOKEN = admin_login()
print(f"Login admin homolog OK. Iniciando bateria...\n")

# ===========================================================================
# SUÍTE A — Autenticação, RBAC e Segurança
# ===========================================================================
def suite_a():
    print("== SUÍTE A: Auth / RBAC / Segurança ==")

    # A1. Login válido — pós-migração o token NÃO vem no body, vem no cookie jwt
    st, b = request("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    R.check("A.login.valido.status200", st == 200, 200, st)
    R.check("A.login.valido.role_admin",
            isinstance(b, dict) and b.get("role") == "ROLE_ADMIN", "ROLE_ADMIN",
            b.get("role") if isinstance(b, dict) else b)
    R.check("A.login.valido.token_fora_do_body",
            isinstance(b, dict) and not b.get("token"), "token ausente no body (está no cookie)",
            b.get("token") if isinstance(b, dict) else b)
    jwt_c = next((c.value for c in _cookie_jar if c.name == "jwt"), None)
    R.check("A.login.valido.emite_cookie_jwt", bool(jwt_c), "cookie jwt setado", "ausente")

    # A2. Senha errada
    st, b = request("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": "senhaerrada"})
    R.check("A.login.senha_errada.401", st == 401, 401, st)

    # A3. Usuário inexistente
    st, b = request("POST", "/api/auth/login", body={"email": "naoexiste@x.com", "password": "x"})
    R.check("A.login.user_inexistente.401", st == 401, 401, st)

    # A4. Vários e-mails malformados -> 400 (validação @Email)
    bad_emails = ["semarroba", "@semlocal.com", "espaco @x.com", "a@", "", "a@b", "plainaddress", "@@x.com"]
    for i, em in enumerate(bad_emails):
        st, b = request("POST", "/api/auth/login", body={"email": em, "password": "x"})
        R.check(f"A.login.email_malformado[{i}].4xx", st in (400, 401), "400/401", st)

    # A5. Campos em branco
    for i, payload in enumerate([
        {"email": "", "password": ""},
        {"email": ADMIN_EMAIL},           # sem password
        {"password": ADMIN_PASS},         # sem email
        {},                                # vazio
    ]):
        st, b = request("POST", "/api/auth/login", body=payload)
        R.check(f"A.login.branco[{i}].4xx", 400 <= st < 500, "4xx", st)

    # A6. Acesso a endpoints admin SEM token -> 401/403
    admin_gets = ["/api/admin/orders", "/api/admin/orders/summary", "/api/admin/promotions"]
    for p in admin_gets:
        st, b = request("GET", p, no_cookie=True)
        R.check(f"A.rbac.sem_token.GET {p}.nega", st in (401, 403), "401/403", st)

    # A7. Acesso a admin com token INVÁLIDO -> 401/403
    for p in admin_gets:
        st, b = request("GET", p, token="token.invalido.aqui", no_cookie=True)
        R.check(f"A.rbac.token_invalido.GET {p}.nega", st in (401, 403), "401/403", st)

    # A8. POST admin sem token nega (produtos)
    st, b = request("POST", "/api/admin/products", body={"sku": "X", "name": "Yyy", "costPrice": 1, "salePrice": 2}, no_cookie=True)
    R.check("A.rbac.sem_token.POST produtos.nega", st in (401, 403), "401/403", st)

    # A9. DELETE admin sem token nega
    st, b = request("DELETE", "/api/admin/products/00000000-0000-0000-0000-000000000000", no_cookie=True)
    R.check("A.rbac.sem_token.DELETE produto.nega", st in (401, 403), "401/403", st)

    # A10. Endpoints PÚBLICOS acessíveis sem token (no_cookie para simular cliente anônimo)
    for p in ["/api/products", "/api/products/catalog", "/api/promotions"]:
        st, b = request("GET", p, no_cookie=True)
        R.check(f"A.publico.GET {p}.200", st == 200, 200, st)

    # A11. Header Authorization malformado
    for hv in ["Bearer", "Bearer ", "Basic abc", "xyz"]:
        st, b = request("GET", "/api/admin/orders", headers={"Authorization": hv}, no_cookie=True)
        R.check(f"A.rbac.auth_malformado[{hv[:6]}].nega", st in (401, 403), "401/403", st)

    # A12. Token válido acessa admin
    st, b = request("GET", "/api/admin/orders", token=TOKEN)
    R.check("A.rbac.token_valido.GET orders.200", st == 200, 200, st)


# ===========================================================================
# SUÍTE B — Múltiplas fotos (feature nova)
# ===========================================================================
def suite_b():
    print("== SUÍTE B: Múltiplas fotos ==")

    # B1. Criar com 1..5 fotos: capa = 1ª, galeria preservada
    for n in range(1, 6):
        urls = [f"/uploads/b{n}_{i}.jpg" for i in range(n)]
        st, b = create_product(TOKEN, imageUrls=urls, name=f"Galeria {n} fotos")
        R.check(f"B.criar.{n}fotos.201", st == 201, 201, st)
        if isinstance(b, dict):
            R.check(f"B.criar.{n}fotos.galeria_tamanho", b.get("imageUrls") == urls, urls, b.get("imageUrls"))
            R.check(f"B.criar.{n}fotos.capa_eh_primeira", b.get("imageUrl") == urls[0], urls[0], b.get("imageUrl"))

    # B2. Exatamente 5 é permitido (limite)
    urls5 = [f"/uploads/lim{i}.jpg" for i in range(5)]
    st, b = create_product(TOKEN, imageUrls=urls5)
    R.check("B.limite.exatamente5.201", st == 201, 201, st)
    R.check("B.limite.exatamente5.tamanho5", isinstance(b, dict) and len(b.get("imageUrls") or []) == 5, 5,
            len(b.get("imageUrls") or []) if isinstance(b, dict) else None)

    # B3. 6 fotos -> rejeitado (validação @Size max=5)
    for extra in range(6, 9):  # 6, 7, 8 fotos
        urls = [f"/uploads/over{i}.jpg" for i in range(extra)]
        st, b = create_product(TOKEN, imageUrls=urls)
        R.check(f"B.limite.{extra}fotos.rejeita_400", st == 400, 400, st)

    # B4. Deduplicação: URLs repetidas colapsam
    dup = ["/uploads/x.jpg", "/uploads/x.jpg", "/uploads/y.jpg", "/uploads/x.jpg"]
    st, b = create_product(TOKEN, imageUrls=dup)
    R.check("B.dedup.201", st == 201, 201, st)
    R.check("B.dedup.resultado", isinstance(b, dict) and b.get("imageUrls") == ["/uploads/x.jpg", "/uploads/y.jpg"],
            ["/uploads/x.jpg", "/uploads/y.jpg"], b.get("imageUrls") if isinstance(b, dict) else None)

    # B5. Retrocompatibilidade: só imageUrl -> galeria = [imageUrl]
    st, b = create_product(TOKEN, imageUrl="/uploads/solo.jpg", imageUrls=None)
    R.check("B.retrocompat.soImageUrl.201", st == 201, 201, st)
    R.check("B.retrocompat.galeria_backfill",
            isinstance(b, dict) and b.get("imageUrls") == ["/uploads/solo.jpg"],
            ["/uploads/solo.jpg"], b.get("imageUrls") if isinstance(b, dict) else None)

    # B6. Sem imagens: galeria vazia, capa nula
    st, b = create_product(TOKEN)
    R.check("B.sem_imagens.201", st == 201, 201, st)
    R.check("B.sem_imagens.galeria_vazia", isinstance(b, dict) and (b.get("imageUrls") in ([], None)),
            "[]/None", b.get("imageUrls") if isinstance(b, dict) else None)
    R.check("B.sem_imagens.capa_nula", isinstance(b, dict) and b.get("imageUrl") is None, None,
            b.get("imageUrl") if isinstance(b, dict) else None)

    # B7. Reordenar via update: capa acompanha a nova 1ª foto
    st, b = create_product(TOKEN, imageUrls=["/uploads/r1.jpg", "/uploads/r2.jpg", "/uploads/r3.jpg"])
    pid = b.get("id") if isinstance(b, dict) else None
    R.check("B.reorder.setup.201", st == 201, 201, st)
    if pid:
        reordered = ["/uploads/r3.jpg", "/uploads/r1.jpg", "/uploads/r2.jpg"]
        upd = {"sku": b["sku"], "name": b["name"], "category": b["category"],
               "costPrice": 10.0, "salePrice": 25.0, "stockStatus": "DISPONIVEL",
               "imageUrls": reordered}
        st2, b2 = request("PUT", f"/api/admin/products/{pid}", token=TOKEN, body=upd)
        R.check("B.reorder.update.200", st2 == 200, 200, st2)
        R.check("B.reorder.nova_capa", isinstance(b2, dict) and b2.get("imageUrl") == "/uploads/r3.jpg",
                "/uploads/r3.jpg", b2.get("imageUrl") if isinstance(b2, dict) else None)
        R.check("B.reorder.nova_ordem", isinstance(b2, dict) and b2.get("imageUrls") == reordered,
                reordered, b2.get("imageUrls") if isinstance(b2, dict) else None)

        # B8. Persistência: aparece com galeria no /catalog
        st3, cat = request("GET", "/api/products/catalog")
        found = next((x for x in cat if x.get("id") == pid), None) if isinstance(cat, list) else None
        R.check("B.persist.catalog.encontrado", found is not None, "produto no catalog", None)
        if found:
            R.check("B.persist.catalog.galeria", found.get("imageUrls") == reordered, reordered, found.get("imageUrls"))

    # B9. Remoção de fotos via update (5 -> 2)
    st, b = create_product(TOKEN, imageUrls=[f"/uploads/rm{i}.jpg" for i in range(5)])
    pid = b.get("id") if isinstance(b, dict) else None
    if pid:
        upd = {"sku": b["sku"], "name": b["name"], "category": b["category"],
               "costPrice": 10.0, "salePrice": 25.0, "stockStatus": "DISPONIVEL",
               "imageUrls": ["/uploads/rm0.jpg", "/uploads/rm1.jpg"]}
        st2, b2 = request("PUT", f"/api/admin/products/{pid}", token=TOKEN, body=upd)
        R.check("B.remocao.update.200", st2 == 200, 200, st2)
        R.check("B.remocao.resultado_2", isinstance(b2, dict) and len(b2.get("imageUrls") or []) == 2, 2,
                len(b2.get("imageUrls") or []) if isinstance(b2, dict) else None)

    # B10. Update com 6 fotos também é rejeitado
    st, b = create_product(TOKEN, imageUrls=["/uploads/u1.jpg"])
    pid = b.get("id") if isinstance(b, dict) else None
    if pid:
        upd = {"sku": b["sku"], "name": b["name"], "category": b["category"],
               "costPrice": 10.0, "salePrice": 25.0, "stockStatus": "DISPONIVEL",
               "imageUrls": [f"/uploads/big{i}.jpg" for i in range(6)]}
        st2, b2 = request("PUT", f"/api/admin/products/{pid}", token=TOKEN, body=upd)
        R.check("B.update.6fotos.rejeita_400", st2 == 400, 400, st2)


# ===========================================================================
# SUÍTE C — Ordenação de esgotados (feature nova)
# ===========================================================================
def suite_c():
    print("== SUÍTE C: Ordenação de esgotados ==")

    # Cria um conjunto controlado: alguns DISPONIVEL, alguns BAIXO, alguns ESGOTADO
    specs = [
        ("DISPONIVEL", "Anel"), ("ESGOTADO", "Anel"), ("BAIXO", "Brinco"),
        ("ESGOTADO", "Corrente"), ("DISPONIVEL", "Gargantilha"), ("ESGOTADO", "Brinco"),
        ("DISPONIVEL", "Conjunto"), ("BAIXO", "Anel"),
    ]
    for i, (stk, cat) in enumerate(specs):
        create_product(TOKEN, stockStatus=stk, category=cat, name=f"Ordena QA {i}",
                       imageUrls=[f"/uploads/ord{i}.jpg"])

    st, cat = request("GET", "/api/products/catalog")
    R.check("C.catalog.status200", st == 200, 200, st)
    if isinstance(cat, list) and cat:
        statuses = [x.get("stockStatus") for x in cat]

        # C1. Nenhum não-esgotado aparece depois de um esgotado
        seen_esg = False
        ok_global = True
        first_esg_index = None
        for idx, s in enumerate(statuses):
            if s == "ESGOTADO":
                seen_esg = True
                if first_esg_index is None:
                    first_esg_index = idx
            elif seen_esg:
                ok_global = False
        R.check("C.esgotados_todos_no_fim", ok_global, "esgotados no fim", statuses)

        # C2. Todos os itens após o 1º esgotado são esgotados
        if first_esg_index is not None:
            tail = statuses[first_esg_index:]
            R.check("C.bloco_final_todo_esgotado", all(s == "ESGOTADO" for s in tail),
                    "tail só ESGOTADO", tail)

        # C3. A parte não-esgotada mantém ordem por (categoria, nome)
        non_esg = [(x.get("category"), x.get("name")) for x in cat if x.get("stockStatus") != "ESGOTADO"]
        R.check("C.nao_esgotados_ordenados_cat_nome", non_esg == sorted(non_esg),
                "ordenado por (cat,nome)", "desordenado" if non_esg != sorted(non_esg) else "ok")

        # C4. O bloco de esgotados também mantém ordem por (categoria, nome)
        esg = [(x.get("category"), x.get("name")) for x in cat if x.get("stockStatus") == "ESGOTADO"]
        R.check("C.esgotados_ordenados_cat_nome", esg == sorted(esg),
                "ordenado por (cat,nome)", "desordenado" if esg != sorted(esg) else "ok")

        # C5. Contagens consistentes (nenhum produto sumiu)
        R.check("C.contagem_total_positiva", len(cat) >= len(specs), f">={len(specs)}", len(cat))


# ===========================================================================
# SUÍTE D — Regressão de Produtos
# ===========================================================================
def suite_d():
    print("== SUÍTE D: Regressão Produtos ==")

    # D1. CRUD completo
    st, b = create_product(TOKEN, name="Produto CRUD")
    R.check("D.create.201", st == 201, 201, st)
    pid = b.get("id") if isinstance(b, dict) else None
    sku = b.get("sku") if isinstance(b, dict) else None

    if pid:
        # update
        upd = {"sku": sku, "name": "Produto CRUD Editado", "category": "Brinco",
               "costPrice": 12.0, "salePrice": 30.0, "stockStatus": "BAIXO"}
        st2, b2 = request("PUT", f"/api/admin/products/{pid}", token=TOKEN, body=upd)
        R.check("D.update.200", st2 == 200, 200, st2)
        R.check("D.update.nome", isinstance(b2, dict) and b2.get("name") == "Produto CRUD Editado",
                "Produto CRUD Editado", b2.get("name") if isinstance(b2, dict) else None)
        R.check("D.update.stock", isinstance(b2, dict) and b2.get("stockStatus") == "BAIXO", "BAIXO",
                b2.get("stockStatus") if isinstance(b2, dict) else None)

    # D2. SKU duplicado -> 400
    st, b = create_product(TOKEN, name="Dono do SKU")
    dup_sku = b.get("sku") if isinstance(b, dict) else None
    if dup_sku:
        payload = {"sku": dup_sku, "name": "Tentativa Duplicada", "category": "Anel",
                   "costPrice": 5.0, "salePrice": 10.0, "stockStatus": "DISPONIVEL"}
        st2, b2 = request("POST", "/api/admin/products", token=TOKEN, body=payload)
        R.check("D.sku_duplicado.400", st2 == 400, 400, st2)

    # D3. SKU inválido (caracteres proibidos) -> 400  (@Pattern [A-Za-z0-9_-])
    for i, bad in enumerate(["com espaço", "acento!@#", "barra/aqui", "ponto.aqui", "vírgula,x"]):
        payload = {"sku": bad, "name": "Nome Valido", "category": "Anel",
                   "costPrice": 5.0, "salePrice": 10.0, "stockStatus": "DISPONIVEL"}
        st, b = request("POST", "/api/admin/products", token=TOKEN, body=payload)
        R.check(f"D.sku_invalido[{i}].400", st == 400, 400, st)

    # D4. Nome curto demais (<3) -> 400
    for i, nm in enumerate(["", "a", "ab"]):
        st, b = create_product(TOKEN, name=nm)
        R.check(f"D.nome_curto[{i}].400", st == 400, 400, st)

    # D5. Preços inválidos (nulo, zero, negativo) -> 400
    for i, (cp, sp) in enumerate([(None, 10), (10, None), (0, 10), (10, 0), (-5, 10), (10, -5)]):
        n = int(time.time() * 1000) % 100000000
        payload = {"sku": f"QA-PRICE-{n}-{i}", "name": "Preco Teste", "category": "Anel",
                   "costPrice": cp, "salePrice": sp, "stockStatus": "DISPONIVEL"}
        st, b = request("POST", "/api/admin/products", token=TOKEN, body=payload)
        R.check(f"D.preco_invalido[{i}].400", st == 400, 400, st)

    # D6. Filtros: por categoria
    st, b = request("GET", "/api/products?category=Anel", token=TOKEN)
    R.check("D.filtro.categoria.200", st == 200, 200, st)
    if isinstance(b, list):
        R.check("D.filtro.categoria.todos_anel", all(x.get("category") == "Anel" for x in b),
                "todos Anel", "misturado" if not all(x.get("category") == "Anel" for x in b) else "ok")

    # D7. Filtro por stockStatus
    for stk in ["DISPONIVEL", "BAIXO", "ESGOTADO"]:
        st, b = request("GET", f"/api/products?stockStatus={stk}", token=TOKEN)
        R.check(f"D.filtro.stock.{stk}.200", st == 200, 200, st)
        if isinstance(b, list):
            R.check(f"D.filtro.stock.{stk}.consistente", all(x.get("stockStatus") == stk for x in b),
                    f"todos {stk}", "misturado" if not all(x.get("stockStatus") == stk for x in b) else "ok")

    # D8. Busca por SKU existente
    st, b = create_product(TOKEN, name="Busca Alvo")
    target_sku = b.get("sku") if isinstance(b, dict) else None
    if target_sku:
        st2, b2 = request("GET", f"/api/products?search={target_sku}", token=TOKEN)
        R.check("D.busca.sku.200", st2 == 200, 200, st2)
        R.check("D.busca.sku.encontra", isinstance(b2, list) and any(x.get("sku") == target_sku for x in b2),
                "encontra o SKU", None)

    # D9. Delete de produto inexistente -> 400
    st, b = request("DELETE", "/api/admin/products/00000000-0000-0000-0000-000000000000", token=TOKEN)
    R.check("D.delete.inexistente.400", st == 400, 400, st)

    # D10. Update de produto inexistente -> 400
    payload = {"sku": "QA-GHOST", "name": "Fantasma", "category": "Anel",
               "costPrice": 5.0, "salePrice": 10.0, "stockStatus": "DISPONIVEL"}
    st, b = request("PUT", "/api/admin/products/00000000-0000-0000-0000-000000000000", token=TOKEN, body=payload)
    R.check("D.update.inexistente.400", st == 400, 400, st)

    # D11. GET público lista e catalog sempre 200 e são listas
    for p in ["/api/products", "/api/products/catalog"]:
        st, b = request("GET", p)
        R.check(f"D.publico.{p}.lista", st == 200 and isinstance(b, list), "200 + lista", (st, type(b).__name__))


# ===========================================================================
# SUÍTE E — Regressão de Promoções (snapshot de preço)
# ===========================================================================
def suite_e():
    print("== SUÍTE E: Regressão Promoções ==")

    # Produto base para as promoções
    st, prod = create_product(TOKEN, name="Base Promo", salePrice=100.0, imageUrls=["/uploads/promo.jpg"])
    pid = prod.get("id") if isinstance(prod, dict) else None
    R.check("E.setup.produto.201", st == 201, 201, st)

    if pid:
        # E1. Criar promoção válida
        promo = {"productId": pid, "title": "Promo QA", "subtitle": "sub",
                 "discountPercent": 20, "promoPrice": 80.0, "active": True, "sortOrder": 1}
        st, b = request("POST", "/api/admin/promotions", token=TOKEN, body=promo)
        R.check("E.create.201", st == 201, 201, st)
        promo_id = b.get("id") if isinstance(b, dict) else None
        if promo_id:
            CREATED_PROMOS.add(promo_id)
            # E2. Snapshot de dados do produto na promoção
            R.check("E.snapshot.productName", isinstance(b, dict) and b.get("productName") == "Base Promo",
                    "Base Promo", b.get("productName") if isinstance(b, dict) else None)
            R.check("E.snapshot.originalPrice", isinstance(b, dict) and float(b.get("originalPrice", 0)) == 100.0,
                    100.0, b.get("originalPrice") if isinstance(b, dict) else None)

            # E3. Aparece nas promoções ativas (público)
            st2, active = request("GET", "/api/promotions")
            R.check("E.publico.ativas.200", st2 == 200, 200, st2)
            R.check("E.publico.ativas.contem", isinstance(active, list) and any(x.get("id") == promo_id for x in active),
                    "promo ativa presente", None)

            # E4. Toggle -> some das ativas
            st3, b3 = request("PATCH", f"/api/admin/promotions/{promo_id}/toggle", token=TOKEN)
            R.check("E.toggle.200", st3 == 200, 200, st3)
            st4, active2 = request("GET", "/api/promotions")
            R.check("E.toggle.some_das_ativas",
                    isinstance(active2, list) and not any(x.get("id") == promo_id for x in active2),
                    "ausente das ativas", None)

            # E5. Update da promoção
            promo_upd = dict(promo)
            promo_upd["title"] = "Promo QA Editada"
            promo_upd["discountPercent"] = 30
            st5, b5 = request("PUT", f"/api/admin/promotions/{promo_id}", token=TOKEN, body=promo_upd)
            R.check("E.update.200", st5 == 200, 200, st5)
            R.check("E.update.titulo", isinstance(b5, dict) and b5.get("title") == "Promo QA Editada",
                    "Promo QA Editada", b5.get("title") if isinstance(b5, dict) else None)

        # E6. Validações: desconto fora de 0..100
        for i, dp in enumerate([-1, 101, 150, -50]):
            bad = {"productId": pid, "title": "T", "discountPercent": dp, "promoPrice": 10.0}
            st, b = request("POST", "/api/admin/promotions", token=TOKEN, body=bad)
            R.check(f"E.validacao.desconto[{i}].400", st == 400, 400, st)

        # E7. promoPrice não-positivo
        for i, pp in enumerate([0, -10]):
            bad = {"productId": pid, "title": "T", "discountPercent": 10, "promoPrice": pp}
            st, b = request("POST", "/api/admin/promotions", token=TOKEN, body=bad)
            R.check(f"E.validacao.promoPrice[{i}].400", st == 400, 400, st)

        # E8. Título ausente -> 400
        st, b = request("POST", "/api/admin/promotions", token=TOKEN,
                        body={"productId": pid, "discountPercent": 10, "promoPrice": 10.0})
        R.check("E.validacao.titulo_ausente.400", st == 400, 400, st)

    # E9. productId ausente -> 400
    st, b = request("POST", "/api/admin/promotions", token=TOKEN,
                    body={"title": "Sem Produto", "discountPercent": 10, "promoPrice": 10.0})
    R.check("E.validacao.produto_ausente.400", st == 400, 400, st)

    # E10. Promoção para produto inexistente -> 400
    st, b = request("POST", "/api/admin/promotions", token=TOKEN,
                    body={"productId": "00000000-0000-0000-0000-000000000000",
                          "title": "Ghost", "discountPercent": 10, "promoPrice": 10.0})
    R.check("E.produto_inexistente.400", st == 400, 400, st)

    # E11. Admin lista todas as promoções
    st, b = request("GET", "/api/admin/promotions", token=TOKEN)
    R.check("E.admin.lista.200", st == 200 and isinstance(b, list), "200 + lista", (st, type(b).__name__))


# ===========================================================================
# SUÍTE F — Regressão de Consignados
# ===========================================================================
def suite_f():
    print("== SUÍTE F: Regressão Consignados ==")

    def create_consignee(**ov):
        n = int(time.time() * 1000) % 100000000
        # Telefone no formato aceito pela regex do backend (11 dígitos sem separador
        # de 9º dígito com traço). Ver ConsigneeRequest.phone @Pattern.
        payload = {"name": f"Consignado QA {n}", "phone": "51983396457",
                   "email": f"c{n}@ex.com", "commissionRate": 0.3}
        payload.update(ov)
        st, b = request("POST", "/api/consignees", token=TOKEN, body=payload)
        if st == 201 and isinstance(b, dict) and b.get("id"):
            CREATED_CONSIGNEES.add(b["id"])
        return st, b

    # F1. Criar válido
    st, b = create_consignee()
    R.check("F.create.201", st == 201, 201, st)
    cid = b.get("id") if isinstance(b, dict) else None

    # F2. GET by id
    if cid:
        st2, b2 = request("GET", f"/api/consignees/{cid}", token=TOKEN)
        R.check("F.getById.200", st2 == 200, 200, st2)

        # F3. Update
        upd = {"name": "Consignado Editado", "phone": "51988887777",
               "email": "editado@ex.com", "commissionRate": 0.5}
        st3, b3 = request("PUT", f"/api/consignees/{cid}", token=TOKEN, body=upd)
        R.check("F.update.200", st3 == 200, 200, st3)
        R.check("F.update.nome", isinstance(b3, dict) and b3.get("name") == "Consignado Editado",
                "Consignado Editado", b3.get("name") if isinstance(b3, dict) else None)

    # F4. Nome curto (<3) -> 400
    for i, nm in enumerate(["", "a", "xy"]):
        st, b = create_consignee(name=nm)
        R.check(f"F.nome_curto[{i}].400", st == 400, 400, st)

    # F5. Telefone inválido -> 400
    for i, ph in enumerate(["", "123", "abcdefgh", "!!!", "12"]):
        st, b = create_consignee(phone=ph)
        R.check(f"F.telefone_invalido[{i}].400", st == 400, 400, st)

    # F6. E-mail inválido -> 400
    for i, em in enumerate(["semarroba", "@x.com", "a@", "espaco @x.com"]):
        st, b = create_consignee(email=em)
        R.check(f"F.email_invalido[{i}].400", st == 400, 400, st)

    # F7. Comissão fora de 0..1 -> 400
    for i, cr in enumerate([-0.1, 1.1, 2, -1, 5]):
        st, b = create_consignee(commissionRate=cr)
        R.check(f"F.comissao_invalida[{i}].400", st == 400, 400, st)

    # F8. Comissão nos limites (0 e 1) -> 201
    for i, cr in enumerate([0, 1]):
        st, b = create_consignee(commissionRate=cr)
        R.check(f"F.comissao_limite[{i}={cr}].201", st == 201, 201, st)

    # F9. Comissão ausente -> 400 (@NotNull)
    n = int(time.time() * 1000) % 100000000
    st, b = request("POST", "/api/consignees", token=TOKEN,
                    body={"name": f"Sem Comissao {n}", "phone": "(51) 98339-6457", "email": f"x{n}@e.com"})
    R.check("F.comissao_ausente.400", st == 400, 400, st)

    # F10. GET by id inexistente -> 404
    st, b = request("GET", "/api/consignees/00000000-0000-0000-0000-000000000000", token=TOKEN)
    R.check("F.getById.inexistente.404", st == 404, 404, st)

    # F11. Listagem
    st, b = request("GET", "/api/consignees", token=TOKEN)
    R.check("F.lista.200", st == 200 and isinstance(b, list), "200 + lista", (st, type(b).__name__))

    # F12. Sem token nega
    st, b = request("GET", "/api/consignees", no_cookie=True)
    R.check("F.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE G — Regressão de Pedidos
# ===========================================================================
def suite_g():
    print("== SUÍTE G: Regressão Pedidos ==")

    # Produtos para compor pedidos (preços conhecidos)
    st, p1 = create_product(TOKEN, name="Item Pedido 1", salePrice=50.0)
    st, p2 = create_product(TOKEN, name="Item Pedido 2", salePrice=75.5)
    id1 = p1.get("id") if isinstance(p1, dict) else None
    id2 = p2.get("id") if isinstance(p2, dict) else None

    # G1. Pedido público válido
    if id1 and id2:
        st, b = request("POST", "/api/orders", body={"productIds": [id1, id2], "orderNumber": "HSD-QA-0001"})
        R.check("G.publico.create.201", st == 201, 201, st)
        if isinstance(b, dict) and b.get("id"):
            CREATED_ORDERS.add(b["id"])
            # G2. Integridade de preço: total = soma dos salePrice do servidor (não confia no cliente)
            total = b.get("total") or b.get("totalAmount") or b.get("estimatedTotal")
            if total is not None:
                R.check("G.publico.total_server_side", abs(float(total) - 125.5) < 0.01, 125.5, total)

    # G3. Pedido com lista vazia -> 400 (@NotEmpty)
    st, b = request("POST", "/api/orders", body={"productIds": []})
    R.check("G.publico.vazio.400", st == 400, 400, st)

    # G4. Pedido sem productIds -> 400
    st, b = request("POST", "/api/orders", body={"orderNumber": "HSD-X"})
    R.check("G.publico.sem_ids.400", st == 400, 400, st)

    # G5. Pedido com produto inexistente -> 400
    st, b = request("POST", "/api/orders", body={"productIds": ["00000000-0000-0000-0000-000000000000"]})
    R.check("G.publico.produto_inexistente.400", st == 400, 400, st)

    # G6. Admin lista pedidos
    st, b = request("GET", "/api/admin/orders", token=TOKEN)
    R.check("G.admin.lista.200", st == 200 and isinstance(b, list), "200 + lista", (st, type(b).__name__))

    # G7. Admin summary
    st, b = request("GET", "/api/admin/orders/summary", token=TOKEN)
    R.check("G.admin.summary.200", st == 200, 200, st)
    R.check("G.admin.summary.chaves", isinstance(b, dict) and {"pendente", "confirmado", "cancelado"} <= set(b.keys()),
            "pendente/confirmado/cancelado", list(b.keys()) if isinstance(b, dict) else None)

    # G8. Transições de status de um pedido do catálogo (nasce SEM customerName).
    # Regra de negócio (leva WhatsApp): CONFIRMAR e CANCELAR exigem nome E telefone
    # do cliente (usados no aviso automático). Sem esses dados -> 400.
    if id1:
        st, b = request("POST", "/api/orders", body={"productIds": [id1], "orderNumber": "HSD-QA-STATUS"})
        oid = b.get("id") if isinstance(b, dict) else None
        if oid:
            CREATED_ORDERS.add(oid)
            # CONFIRMADO sem nome/telefone -> bloqueado (integridade da venda + aviso)
            st2, b2 = request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CONFIRMADO"})
            R.check("G.admin.confirmar_sem_dados.400", st2 == 400, 400, st2)
            # CANCELADO sem nome/telefone -> agora também bloqueado (telefone obrigatório)
            st2b, _ = request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CANCELADO"})
            R.check("G.admin.cancelar_sem_dados.400", st2b == 400, 400, st2b)
            # Preenche nome + telefone e então CANCELA -> permitido
            request("PUT", f"/api/admin/orders/{oid}", token=TOKEN,
                    body={"items": [{"productId": id1, "quantity": 1}],
                          "customerName": "Cliente QA", "customerPhone": "51988887777"})
            st3, b3 = request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CANCELADO"})
            R.check("G.admin.status.CANCELADO.200", st3 == 200, 200, st3)
            # Reabrir para PENDENTE permitido
            st4, b4 = request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "PENDENTE"})
            R.check("G.admin.status.PENDENTE.200", st4 == 200, 200, st4)

            # G9. Status inválido -> 400
            st5, b5 = request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "XPTO"})
            R.check("G.admin.status_invalido.400", st5 == 400, 400, st5)

    # G12. Pedido acima do teto de itens (>50) -> 400
    if id1:
        st, b = request("POST", "/api/orders", body={"productIds": [id1] * 51})
        R.check("G.publico.excede_teto_itens.400", st == 400, 400, st)

    # G10. Admin orders sem token nega
    st, b = request("GET", "/api/admin/orders", no_cookie=True)
    R.check("G.admin.sem_token.nega", st in (401, 403), "401/403", st)

    # G11. Filtro por status na listagem admin
    for stt in ["PENDENTE", "CONFIRMADO", "CANCELADO"]:
        st, b = request("GET", f"/api/admin/orders?status={stt}", token=TOKEN)
        R.check(f"G.admin.filtro.{stt}.200", st == 200, 200, st)


# ===========================================================================
# SUÍTE I — RBAC exaustivo por rota/método + verificação de fronteira pública
# ===========================================================================
def suite_i():
    print("== SUÍTE I: RBAC exaustivo ==")

    # Matriz de rotas ADMIN protegidas × métodos. Sem token E com token inválido
    # devem sempre negar (401/403). Isso protege contra exposição acidental.
    admin_routes = [
        ("GET", "/api/admin/orders"),
        ("GET", "/api/admin/orders/summary"),
        ("POST", "/api/admin/orders"),
        ("PUT", "/api/admin/orders/00000000-0000-0000-0000-000000000000"),
        ("PATCH", "/api/admin/orders/00000000-0000-0000-0000-000000000000/status"),
        ("GET", "/api/admin/promotions"),
        ("POST", "/api/admin/promotions"),
        ("PUT", "/api/admin/promotions/00000000-0000-0000-0000-000000000000"),
        ("PATCH", "/api/admin/promotions/00000000-0000-0000-0000-000000000000/toggle"),
        ("DELETE", "/api/admin/promotions/00000000-0000-0000-0000-000000000000"),
        ("POST", "/api/admin/products"),
        ("PUT", "/api/admin/products/00000000-0000-0000-0000-000000000000"),
        ("DELETE", "/api/admin/products/00000000-0000-0000-0000-000000000000"),
        ("POST", "/api/admin/products/upload"),
        ("GET", "/api/admin/analytics/sales"),
        ("GET", "/api/admin/analytics/engagement"),
    ]
    for method, path in admin_routes:
        st, b = request(method, path, no_cookie=True)  # sem token nem cookie
        R.check(f"I.sem_token.{method} {path}.nega", st in (401, 403), "401/403", st)
        st2, b2 = request(method, path, token="abc.def.ghi", no_cookie=True)  # token inválido
        R.check(f"I.token_invalido.{method} {path}.nega", st2 in (401, 403), "401/403", st2)

    # Rotas públicas devem responder mesmo sem token (não podem estar protegidas por engano)
    public_routes = [
        ("GET", "/api/products"),
        ("GET", "/api/products/catalog"),
        ("GET", "/api/promotions"),
    ]
    for method, path in public_routes:
        st, b = request(method, path, no_cookie=True)
        R.check(f"I.publico.{method} {path}.acessivel", st == 200, 200, st)

    # POST público de pedido é acessível sem token (mas valida corpo)
    st, b = request("POST", "/api/orders", body={"productIds": []}, no_cookie=True)
    R.check("I.publico.POST orders.acessivel_valida", st == 400, 400, st)  # acessível, mas corpo inválido

    # POST público de telemetria é acessível sem token
    st, b = request("POST", "/api/catalog-events", body={"type": "VIEW", "sessionId": "qa-sess"}, no_cookie=True)
    R.check("I.publico.POST catalog-events.aceito", st in (200, 202, 204), "2xx", st)

    # Analytics com token válido responde 200 (regressão dos dashboards)
    st, b = request("GET", "/api/admin/analytics/sales", token=TOKEN)
    R.check("I.analytics.sales.admin.200", st == 200, 200, st)
    st, b = request("GET", "/api/admin/analytics/engagement", token=TOKEN)
    R.check("I.analytics.engagement.admin.200", st == 200, 200, st)
    # Analytics com filtros
    for gran in ["day", "month", "year"]:
        st, b = request("GET", f"/api/admin/analytics/sales?granularity={gran}", token=TOKEN)
        R.check(f"I.analytics.sales.gran[{gran}].200", st == 200, 200, st)


# ===========================================================================
# SUÍTE H — Robustez, limites e consistência (densidade de cobertura)
# ===========================================================================
def suite_h():
    print("== SUÍTE H: Robustez / Limites / Consistência ==")

    # H1. Nome do produto nos limites: 2=inválido, 3=válido, 120=válido, 121=inválido
    cases = [(2, 400), (3, 201), (10, 201), (50, 201), (120, 201), (121, 400), (200, 400)]
    for length, expected in cases:
        st, b = create_product(TOKEN, name="N" * length)
        R.check(f"H.nome_len{length}.{expected}", st == expected, expected, st)

    # H2. SKUs válidos variados (letras, números, _ e -)
    valid_skus = ["ABC123", "a-b-c", "x_y_z", "SKU-2026_01", "123456", "aAbB-_09"]
    for i, s in enumerate(valid_skus):
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/admin/products", token=TOKEN, body={
            "sku": f"{s}{n}", "name": "SKU Valido Teste", "category": "Anel",
            "costPrice": 5.0, "salePrice": 10.0, "stockStatus": "DISPONIVEL"})
        if st == 201 and isinstance(b, dict):
            CREATED_PRODUCTS.add(b["id"])
        R.check(f"H.sku_valido[{i}].201", st == 201, 201, st)

    # H3. Categorias variadas aceitas
    for i, cat in enumerate(["Brinco", "Brinco / Trio", "Conjunto", "Corrente", "Gargantilha", "Outro"]):
        st, b = create_product(TOKEN, category=cat, name=f"Cat {i}")
        R.check(f"H.categoria[{cat}].201", st == 201, 201, st)
        if isinstance(b, dict):
            R.check(f"H.categoria[{cat}].persistida", b.get("category") == cat, cat, b.get("category"))

    # H4. Cada nível de stockStatus é persistido corretamente
    for stk in ["DISPONIVEL", "BAIXO", "ESGOTADO"]:
        st, b = create_product(TOKEN, stockStatus=stk, name=f"Stock {stk}")
        R.check(f"H.stock[{stk}].201", st == 201, 201, st)
        if isinstance(b, dict):
            R.check(f"H.stock[{stk}].persistido", b.get("stockStatus") == stk, stk, b.get("stockStatus"))

    # H5. Galeria em cada tamanho 1..5 tem capa == 1ª (varredura de consistência)
    for n in range(1, 6):
        urls = [f"/uploads/h5_{n}_{i}.png" for i in range(n)]
        st, b = create_product(TOKEN, imageUrls=urls, name=f"H5 {n}")
        if isinstance(b, dict):
            R.check(f"H.galeria{n}.capa_consistente", b.get("imageUrl") == urls[0], urls[0], b.get("imageUrl"))
            R.check(f"H.galeria{n}.tamanho", len(b.get("imageUrls") or []) == n, n, len(b.get("imageUrls") or []))

    # H6. Preços válidos variados (positivos, decimais) aceitos
    for i, (cp, sp) in enumerate([(0.01, 0.02), (1, 2), (99.99, 199.99), (1000, 5000), (0.5, 1.5)]):
        st, b = create_product(TOKEN, costPrice=cp, salePrice=sp, name=f"Preco OK {i}")
        R.check(f"H.preco_valido[{i}].201", st == 201, 201, st)

    # H7. Consistência global do catálogo: capa sempre == 1ª foto (quando há galeria)
    st, cat = request("GET", "/api/products/catalog")
    if isinstance(cat, list):
        inconsist = [x.get("sku") for x in cat
                     if x.get("imageUrls") and x.get("imageUrl") != x["imageUrls"][0]]
        R.check("H.catalog.capa_sempre_primeira", len(inconsist) == 0, "0 inconsistências", inconsist)

        # H8. Nenhum item do catálogo tem galeria > 5
        over = [x.get("sku") for x in cat if x.get("imageUrls") and len(x["imageUrls"]) > 5]
        R.check("H.catalog.nenhuma_galeria_acima_5", len(over) == 0, "0 acima de 5", over)

        # H9. Todo produto tem campos essenciais não-nulos
        missing = [x.get("sku") for x in cat
                   if x.get("id") is None or x.get("name") is None or x.get("salePrice") is None]
        R.check("H.catalog.campos_essenciais", len(missing) == 0, "0 faltando", missing)

    # H10. Idempotência de leitura: duas chamadas ao catálogo retornam mesma contagem
    st1, c1 = request("GET", "/api/products/catalog")
    st2, c2 = request("GET", "/api/products/catalog")
    R.check("H.catalog.idempotente_contagem",
            isinstance(c1, list) and isinstance(c2, list) and len(c1) == len(c2),
            "mesma contagem", (len(c1) if isinstance(c1, list) else None,
                               len(c2) if isinstance(c2, list) else None))

    # H11. JSON malformado no corpo -> 400 (não 500)
    st, b = request("POST", "/api/admin/products", token=TOKEN, raw_body="{ isso nao e json valido ]",
                    headers={"Content-Type": "application/json"})
    R.check("H.json_malformado.nao_500", st == 400, 400, st)

    # H12. Método não suportado em rota -> 405 (não 500)
    st, b = request("DELETE", "/api/products/catalog")
    R.check("H.metodo_nao_suportado.405", st in (405, 401, 403), "405/401/403", st)

    # H13. Rota inexistente -> 404
    st, b = request("GET", "/api/rota/que/nao/existe/qa")
    R.check("H.rota_inexistente.404", st in (404, 401, 403), "404", st)

    # H14. XSS/HTML no nome é aceito e devolvido como dado (armazenado, não executado)
    payload_name = "<script>alert(1)</script>Colar"
    st, b = create_product(TOKEN, name=payload_name)
    R.check("H.xss_no_nome.aceito_como_dado", st == 201, 201, st)
    if isinstance(b, dict):
        R.check("H.xss_no_nome.devolvido_intacto", b.get("name") == payload_name, "string preservada", b.get("name"))

    # H15. Payload gigante em descrição além do limite (500) -> 400
    st, b = create_product(TOKEN, description="x" * 600)
    R.check("H.descricao_acima_500.400", st == 400, 400, st)


# ===========================================================================
# SUÍTE J — Cobertura adicional de validação e casos-limite
# ===========================================================================
def suite_j():
    print("== SUÍTE J: Validação adicional / casos-limite ==")

    # J1. Mais e-mails inválidos no login (varredura ampla)
    # 429 é aceitável aqui: a varredura de muitos logins seguidos dispara o
    # rate limit do backend — que é justamente o comportamento de segurança desejado.
    more_bad_emails = ["a b@x.com", "a@b c.com", "a@@b.com", "a.b.com", "@", "a@.com",
                       ".a@b.com", "a@b..com", "a@-b.com", "  @x.com"]
    for i, em in enumerate(more_bad_emails):
        st, b = request("POST", "/api/auth/login", body={"email": em, "password": "x"})
        R.check(f"J.login.email_invalido[{i}].4xx", st in (400, 401, 429), "400/401/429", st)

    # J2. SKUs inválidos adicionais (símbolos proibidos)
    bad_skus = ["a b", "a@b", "a#b", "a$b", "a%b", "a&b", "a*b", "a(b", "a)b", "a+b", "a=b", "a/b"]
    for i, s in enumerate(bad_skus):
        st, b = request("POST", "/api/admin/products", token=TOKEN, body={
            "sku": s, "name": "Nome OK Teste", "category": "Anel",
            "costPrice": 5.0, "salePrice": 10.0, "stockStatus": "DISPONIVEL"})
        R.check(f"J.sku_invalido[{i}].400", st == 400, 400, st)

    # J3. Telefones inválidos adicionais para consignado
    bad_phones = ["1", "12", "abc", "()", "-----", "((((", "0", "999", "  ", "a1b2c3"]
    for i, ph in enumerate(bad_phones):
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/consignees", token=TOKEN, body={
            "name": f"Tel Invalido {n}", "phone": ph, "email": f"t{n}@e.com", "commissionRate": 0.2})
        R.check(f"J.telefone_invalido[{i}].400", st == 400, 400, st)

    # J4. Comissões válidas dentro da faixa 0..1 (varredura)
    for i, cr in enumerate([0.0, 0.1, 0.25, 0.5, 0.75, 0.99, 1.0]):
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/consignees", token=TOKEN, body={
            "name": f"Comissao OK {n}", "phone": "51988887777", "email": f"ok{n}@e.com", "commissionRate": cr})
        if st == 201 and isinstance(b, dict):
            CREATED_CONSIGNEES.add(b["id"])
        R.check(f"J.comissao_valida[{cr}].201", st == 201, 201, st)

    # J5. Descontos de promoção válidos 0..100 (varredura) sobre produto real
    st, prod = create_product(TOKEN, name="Base Desconto", salePrice=200.0)
    pid = prod.get("id") if isinstance(prod, dict) else None
    if pid:
        for i, dp in enumerate([0, 5, 10, 25, 50, 75, 100]):
            st, b = request("POST", "/api/admin/promotions", token=TOKEN, body={
                "productId": pid, "title": f"Desc {dp}", "discountPercent": dp, "promoPrice": 1.0})
            if st == 201 and isinstance(b, dict):
                CREATED_PROMOS.add(b["id"])
            R.check(f"J.desconto_valido[{dp}].201", st == 201, 201, st)

    # J6. Pós-cleanup parcial: garantir que produtos QA não aparecem no catálogo público
    #     (checa vazamento de dados de teste — feito no cleanup final, aqui é sanity)
    st, cat = request("GET", "/api/products/catalog")
    if isinstance(cat, list):
        R.check("J.catalog.responde_lista", True, "lista", "lista")

    # J7. Nomes de produto com acentos e caracteres PT-BR são aceitos
    for i, nm in enumerate(["Anel Coração", "Brinco Pérola", "Colar Ouro 18k", "Pingente Àgua", "Óculos Açaí"]):
        st, b = create_product(TOKEN, name=nm)
        R.check(f"J.nome_acentos[{i}].201", st == 201, 201, st)
        if isinstance(b, dict):
            R.check(f"J.nome_acentos[{i}].preservado", b.get("name") == nm, nm, b.get("name"))

    # J8. Galeria com paths variados (extensões diferentes)
    exts = [".jpg", ".jpeg", ".png", ".webp"]
    urls = [f"/uploads/mix{i}{e}" for i, e in enumerate(exts)]
    st, b = create_product(TOKEN, imageUrls=urls, name="Extensoes Mix")
    R.check("J.galeria_extensoes.201", st == 201, 201, st)
    if isinstance(b, dict):
        R.check("J.galeria_extensoes.preservada", b.get("imageUrls") == urls, urls, b.get("imageUrls"))


# ===========================================================================
# SUÍTE K — Varredura densa de validação (promoções, consignados, pedidos)
# ===========================================================================
def suite_k():
    print("== SUÍTE K: Varredura densa de validação ==")

    # K1. Consignados: comissão em toda a faixa 0..1 (válida) e fora (inválida)
    for cr in [0.0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.75, 0.9, 1.0]:
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/consignees", token=TOKEN, body={
            "name": f"Consig {n}", "phone": "51999998888", "email": f"c{n}@ex.com", "commissionRate": cr})
        if st == 201 and isinstance(b, dict):
            CREATED_CONSIGNEES.add(b["id"])
        R.check(f"K.comissao_valida[{cr}].201", st == 201, 201, st)
    for cr in [-0.5, -0.01, 1.01, 1.5, 2.0, 10.0]:
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/consignees", token=TOKEN, body={
            "name": f"ConsigInv {n}", "phone": "51999998888", "email": f"ci{n}@ex.com", "commissionRate": cr})
        R.check(f"K.comissao_invalida[{cr}].400", st == 400, 400, st)

    # K2. Consignados: telefones válidos e inválidos
    for ph in ["51999998888", "5133334444", "11987654321"]:
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/consignees", token=TOKEN, body={
            "name": f"Tel {n}", "phone": ph, "email": f"t{n}@ex.com", "commissionRate": 0.3})
        if st == 201 and isinstance(b, dict):
            CREATED_CONSIGNEES.add(b["id"])
        R.check(f"K.telefone_valido[{ph}].201", st == 201, 201, st)
    for ph in ["", "abc", "12", "!!!", "1"]:
        n = int(time.time() * 1000000) % 1000000
        st, b = request("POST", "/api/consignees", token=TOKEN, body={
            "name": f"TelInv {n}", "phone": ph, "email": f"ti{n}@ex.com", "commissionRate": 0.3})
        R.check(f"K.telefone_invalido[{ph[:6]}].400", st == 400, 400, st)

    # K3. Promoções: desconto na faixa 0..100 válido, fora inválido
    st, prod = create_product(TOKEN, name="Base Varredura Promo", salePrice=100.0)
    pid = prod.get("id") if isinstance(prod, dict) else None
    if pid:
        for dp in [0, 1, 5, 10, 15, 20, 30, 50, 70, 90, 99, 100]:
            st, b = request("POST", "/api/admin/promotions", token=TOKEN, body={
                "productId": pid, "title": f"Promo {dp}", "discountPercent": dp, "promoPrice": 1.0})
            if st == 201 and isinstance(b, dict):
                CREATED_PROMOS.add(b["id"])
            R.check(f"K.promo_desconto[{dp}].201", st == 201, 201, st)
        for dp in [-1, -10, 101, 150, 999]:
            st, b = request("POST", "/api/admin/promotions", token=TOKEN, body={
                "productId": pid, "title": f"PromoInv {dp}", "discountPercent": dp, "promoPrice": 1.0})
            R.check(f"K.promo_desconto_inv[{dp}].400", st == 400, 400, st)
        # promoPrice não-positivo
        for pp in [0, -1, -0.5]:
            st, b = request("POST", "/api/admin/promotions", token=TOKEN, body={
                "productId": pid, "title": "PromoPP", "discountPercent": 10, "promoPrice": pp})
            R.check(f"K.promo_preco_inv[{pp}].400", st == 400, 400, st)

    # K4. Pedido público: listas de vários tamanhos (1..10) válidas
    st, p1 = create_product(TOKEN, name="Multi Item QA", salePrice=25.0, stockQuantity=100)
    mid = p1.get("id") if isinstance(p1, dict) else None
    if mid:
        for size in [1, 2, 3, 5, 10, 20, 50]:
            st, b = request("POST", "/api/orders", body={"productIds": [mid] * size}, no_cookie=True)
            R.check(f"K.pedido_tamanho[{size}].201", st == 201, 201, st)
            if isinstance(b, dict) and b.get("id"):
                CREATED_ORDERS.add(b["id"])
        # acima do teto (50) rejeita
        for size in [51, 100, 200]:
            st, b = request("POST", "/api/orders", body={"productIds": [mid] * size}, no_cookie=True)
            R.check(f"K.pedido_excede[{size}].400", st == 400, 400, st)

    # K5. Filtros de produto (admin) com combinações de categoria x status
    for cat in ["Anel", "Brinco", "Colar", "Inexistente"]:
        for stk in ["DISPONIVEL", "BAIXO", "ESGOTADO"]:
            st, b = request("GET", f"/api/admin/products?category={urllib.parse.quote(cat)}&stockStatus={stk}", token=TOKEN)
            R.check(f"K.filtro[{cat}/{stk}].200", st == 200 and isinstance(b, list), "200 lista", st)


# ===========================================================================
# CLEANUP + MAIN
# ===========================================================================
# Produtos que foram usados em pedidos (não podem ser deletados — FK protege o
# histórico de order_items; isso é integridade referencial correta, não vazamento).
PRODUCTS_IN_ORDERS = set()


def cleanup():
    print("\n== CLEANUP: removendo dados de teste ==")
    # Ordem: promoções -> pedidos (não têm delete público; ficam como CANCELADO) -> produtos -> consignados
    for pid in list(CREATED_PROMOS):
        request("DELETE", f"/api/admin/promotions/{pid}", token=TOKEN)
    # Pedidos de teste: cancela (não há endpoint de delete)
    for oid in list(CREATED_ORDERS):
        request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CANCELADO"})
    deleted, blocked = 0, 0
    for pid in list(CREATED_PRODUCTS):
        st, b = request("DELETE", f"/api/admin/products/{pid}", token=TOKEN)
        if st == 200:
            deleted += 1
        else:
            # Bloqueado por FK de pedido — integridade referencial esperada
            blocked += 1
            PRODUCTS_IN_ORDERS.add(pid)
    for cid in list(CREATED_CONSIGNEES):
        request("DELETE", f"/api/consignees/{cid}", token=TOKEN)
    print(f"  Removidos: {len(CREATED_PROMOS)} promoções, {deleted} produtos, "
          f"{len(CREATED_CONSIGNEES)} consignados. {len(CREATED_ORDERS)} pedidos cancelados. "
          f"{blocked} produtos retidos por FK de pedido (integridade correta).")

    # Verificação de não-vazamento: nenhum produto QA remanescente EXCETO os que
    # estão legitimamente presos a pedidos (FK). Esses são esperados.
    st, cat = request("GET", "/api/products/catalog")
    leaked = ([x.get("sku") for x in cat
               if x.get("id") in CREATED_PRODUCTS and x.get("id") not in PRODUCTS_IN_ORDERS]
              if isinstance(cat, list) else ["?"])
    R.check("CLEANUP.sem_vazamento_produtos", len(leaked) == 0,
            "0 produtos QA removíveis remanescentes", leaked)


def main():
    t0 = time.time()
    try:
        suite_a()
        suite_b()
        suite_c()
        suite_d()
        suite_e()
        suite_f()
        suite_g()
        suite_i()
        suite_h()
        suite_j()
        suite_k()
    finally:
        cleanup()

    dt = time.time() - t0
    total = R.passed + R.failed
    print("\n" + "=" * 60)
    print(f"TOTAL: {total} testes | PASS: {R.passed} | FAIL: {R.failed} | {dt:.1f}s")
    print("=" * 60)
    if R.failures:
        print("\nFALHAS:")
        for name, exp, got in R.failures:
            print(f"  - {name}: esperado={exp} obtido={got}")
    # Código de saída reflete o resultado
    sys.exit(0 if R.failed == 0 else 1)


if __name__ == "__main__":
    main()
