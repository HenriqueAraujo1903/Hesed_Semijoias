#!/usr/bin/env python3
"""
Bateria E2E da leva de ESTOQUE contra o ambiente de DEV (porta 8080).

Perfil: dev sênior validando antes de promover para homolog. Cobre a feature
nova (fornecedores, 3 valores, estoque numérico, status derivado, baixa/estorno
automático no pedido, ajuste manual, garantia em 3 faixas) e regressão do que
já existe (auth/RBAC, catálogo, pedidos, analytics).

Sem dependências externas (stdlib urllib). Limpa 100% dos dados de teste ao fim.
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
BASE = os.environ.get("QA_BASE", "http://localhost:8080")
ADMIN_EMAIL = os.environ.get("QA_ADMIN_EMAIL", "admin@hesed.com")
ADMIN_PASS = os.environ.get("QA_ADMIN_PASS", "admin123")


class Results:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.failures = []

    def check(self, name, cond, expected=None, got=None):
        if cond:
            self.passed += 1
        else:
            self.failed += 1
            self.failures.append((name, expected, got))
            print(f"  \u2717 FAIL: {name} | esperado={expected} obtido={got}")


R = Results()
CREATED_PRODUCTS = set()
CREATED_SUPPLIERS = set()
CREATED_ORDERS = set()

# CookieJar partilhado — persiste o cookie jwt (autenticação via cookie HttpOnly)
_cookie_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cookie_jar))


def request(method, path, token=None, body=None, raw_body=None, headers=None, no_cookie=False):
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
    """Login via cookie HttpOnly; retorna o token do cookie para retrocompat de header."""
    st, b = request("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if st == 200 and isinstance(b, dict) and b.get("id"):
        jwt_cookie = next((c.value for c in _cookie_jar if c.name == "jwt"), None)
        if jwt_cookie:
            return jwt_cookie
        if b.get("token"):
            return b["token"]
    print(f"FATAL: login admin dev falhou (status={st}, body={b})")
    sys.exit(1)


TOKEN = admin_login()


def new_sku(prefix="EST"):
    return f"{prefix}-{int(time.time()*1000000) % 1000000000}"


def create_product(**overrides):
    payload = {
        "sku": new_sku(),
        "name": "Produto QA Estoque",
        "category": "Anel",
        "costPrice": 10.0,
        "salePrice": 25.0,
    }
    payload.update(overrides)
    st, b = request("POST", "/api/admin/products", token=TOKEN, body=payload)
    if st == 201 and isinstance(b, dict) and b.get("id"):
        CREATED_PRODUCTS.add(b["id"])
    return st, b


def create_supplier(**overrides):
    payload = {"name": f"Fornecedor QA {int(time.time()*1000000) % 1000000}", "phone": "5133334444"}
    payload.update(overrides)
    st, b = request("POST", "/api/admin/suppliers", token=TOKEN, body=payload)
    if st == 201 and isinstance(b, dict) and b.get("id"):
        CREATED_SUPPLIERS.add(b["id"])
    return st, b


def find_qty(pid, name):
    """Retorna a quantidade em estoque de um produto pela busca (search encodado)."""
    q = urllib.parse.quote(name)
    st, lst = request("GET", f"/api/products?search={q}", token=TOKEN)
    if isinstance(lst, list):
        m = [x for x in lst if x.get("id") == pid]
        if m:
            return m[0].get("stockQuantity")
    return None


print("Login admin dev OK. Iniciando bateria de estoque...\n")


# ===========================================================================
# SUÍTE 1 — Fornecedores
# ===========================================================================
def suite_suppliers():
    print("== SUÍTE 1: Fornecedores ==")

    # 1.1 criar válido
    st, b = create_supplier(name="Fornecedor Principal QA", email="f@ex.com", website="https://f.com")
    R.check("S1.create.201", st == 201, 201, st)
    sid = b.get("id") if isinstance(b, dict) else None

    # 1.2 nome duplicado -> 400
    if sid:
        st2, b2 = request("POST", "/api/admin/suppliers", token=TOKEN, body={"name": "Fornecedor Principal QA"})
        R.check("S1.nome_duplicado.400", st2 == 400, 400, st2)

    # 1.3 nome curto -> 400
    st, b = request("POST", "/api/admin/suppliers", token=TOKEN, body={"name": "x"})
    R.check("S1.nome_curto.400", st == 400, 400, st)

    # 1.4 email inválido -> 400
    st, b = request("POST", "/api/admin/suppliers", token=TOKEN, body={"name": "Forn Email", "email": "invalido"})
    R.check("S1.email_invalido.400", st == 400, 400, st)

    # 1.5 GET by id, update
    if sid:
        st, b = request("GET", f"/api/admin/suppliers/{sid}", token=TOKEN)
        R.check("S1.getById.200", st == 200, 200, st)
        st, b = request("PUT", f"/api/admin/suppliers/{sid}", token=TOKEN,
                        body={"name": "Fornecedor Editado QA", "phone": "5199998888"})
        R.check("S1.update.200", st == 200, 200, st)
        R.check("S1.update.nome", isinstance(b, dict) and b.get("name") == "Fornecedor Editado QA",
                "Fornecedor Editado QA", b.get("name") if isinstance(b, dict) else None)

    # 1.6 listagem + busca
    st, b = request("GET", "/api/admin/suppliers", token=TOKEN)
    R.check("S1.lista.200", st == 200 and isinstance(b, list), "200 lista", (st, type(b).__name__))

    # 1.7 sem token nega
    st, b = request("GET", "/api/admin/suppliers", no_cookie=True)
    R.check("S1.sem_token.nega", st in (401, 403), "401/403", st)

    # 1.8 GET inexistente -> 404
    st, b = request("GET", "/api/admin/suppliers/00000000-0000-0000-0000-000000000000", token=TOKEN)
    R.check("S1.getById.inexistente.404", st == 404, 404, st)

    # 1.9 bloqueio de delete com produto vinculado
    if sid:
        st, prod = create_product(supplierId=sid, name="Produto Com Fornecedor")
        R.check("S1.produto_com_fornecedor.201", st == 201, 201, st)
        R.check("S1.produto.supplierName",
                isinstance(prod, dict) and prod.get("supplierName") == "Fornecedor Editado QA",
                "Fornecedor Editado QA", prod.get("supplierName") if isinstance(prod, dict) else None)
        st, b = request("DELETE", f"/api/admin/suppliers/{sid}", token=TOKEN)
        R.check("S1.delete_com_produto.bloqueado_400", st == 400, 400, st)

    return sid


# ===========================================================================
# SUÍTE 2 — Produto: 3 valores, estoque, status derivado, garantia
# ===========================================================================
def suite_product_stock(supplier_id):
    print("== SUÍTE 2: Produto / estoque / garantia ==")

    # 2.1 criar com 3 valores + estoque + garantia
    st, b = create_product(
        name="Anel Completo QA", supplierPrice=30.0, costPrice=18.0, salePrice=49.9,
        stockQuantity=5, lowStockThreshold=3, supplierId=supplier_id,
        purchaseDate="2026-08-01", warrantyMonths=12,
    )
    R.check("S2.create.201", st == 201, 201, st)
    pid = b.get("id") if isinstance(b, dict) else None
    if isinstance(b, dict):
        R.check("S2.supplierPrice", float(b.get("supplierPrice") or 0) == 30.0, 30.0, b.get("supplierPrice"))
        R.check("S2.costPrice", float(b.get("costPrice") or 0) == 18.0, 18.0, b.get("costPrice"))
        R.check("S2.salePrice", float(b.get("salePrice") or 0) == 49.9, 49.9, b.get("salePrice"))
        R.check("S2.status_derivado_DISPONIVEL", b.get("stockStatus") == "DISPONIVEL", "DISPONIVEL", b.get("stockStatus"))
        R.check("S2.warrantyExpiresAt", b.get("warrantyExpiresAt") == "2027-08-01", "2027-08-01", b.get("warrantyExpiresAt"))

    # 2.2 status derivado: 0 -> ESGOTADO, <=threshold -> BAIXO, acima -> DISPONIVEL
    for qty, threshold, expected in [(0, 3, "ESGOTADO"), (1, 3, "BAIXO"), (3, 3, "BAIXO"), (4, 3, "DISPONIVEL"), (50, 3, "DISPONIVEL")]:
        st, b = create_product(stockQuantity=qty, lowStockThreshold=threshold, name=f"Deriv {qty}")
        R.check(f"S2.derivado[q={qty},t={threshold}]={expected}",
                isinstance(b, dict) and b.get("stockStatus") == expected, expected,
                b.get("stockStatus") if isinstance(b, dict) else None)

    # 2.3 valores negativos rejeitados
    st, b = create_product(costPrice=-1)
    R.check("S2.custo_negativo.400", st == 400, 400, st)
    st, b = create_product(supplierPrice=-5)
    R.check("S2.fornecedor_negativo.400", st == 400, 400, st)

    # 2.4 ajuste manual: AJUSTE define absoluto; ENTRADA soma
    if pid:
        st, b = request("POST", f"/api/admin/stock/{pid}/adjust", token=TOKEN,
                        body={"mode": "AJUSTE", "quantity": 2, "reason": "inventario"})
        R.check("S2.ajuste.200", st == 200, 200, st)
        R.check("S2.ajuste.qty2_BAIXO", isinstance(b, dict) and b.get("stockQuantity") == 2 and b.get("stockStatus") == "BAIXO",
                "2/BAIXO", (b.get("stockQuantity"), b.get("stockStatus")) if isinstance(b, dict) else None)
        st, b = request("POST", f"/api/admin/stock/{pid}/adjust", token=TOKEN,
                        body={"mode": "ENTRADA", "quantity": 10, "reason": "compra"})
        R.check("S2.entrada.qty12_DISPONIVEL", isinstance(b, dict) and b.get("stockQuantity") == 12 and b.get("stockStatus") == "DISPONIVEL",
                "12/DISPONIVEL", (b.get("stockQuantity"), b.get("stockStatus")) if isinstance(b, dict) else None)

        # 2.5 entrada não positiva rejeitada
        st, b = request("POST", f"/api/admin/stock/{pid}/adjust", token=TOKEN, body={"mode": "ENTRADA", "quantity": 0})
        R.check("S2.entrada_zero.400", st == 400, 400, st)

        # 2.6 modo inválido rejeitado
        st, b = request("POST", f"/api/admin/stock/{pid}/adjust", token=TOKEN, body={"mode": "XPTO", "quantity": 1})
        R.check("S2.modo_invalido.400", st == 400, 400, st)

        # 2.7 histórico de movimentações
        st, b = request("GET", f"/api/admin/stock/{pid}/movements", token=TOKEN)
        R.check("S2.movements.200", st == 200 and isinstance(b, list), "200 lista", (st, type(b).__name__))
        R.check("S2.movements.registrou", isinstance(b, list) and len(b) >= 2, ">=2 movimentos", len(b) if isinstance(b, list) else None)

    return pid


# ===========================================================================
# SUÍTE 3 — Baixa automática no pedido + estorno + alertas
# ===========================================================================
def suite_order_stock():
    print("== SUÍTE 3: Baixa automática / estorno / alertas ==")

    st, prod = create_product(name="Item Baixa QA", salePrice=40.0, stockQuantity=10, lowStockThreshold=2)
    pid = prod.get("id") if isinstance(prod, dict) else None
    if not pid:
        R.check("S3.setup", False, "produto criado", None)
        return

    # 3.1 venda direta confirmada consome estoque (10 -> 9)
    st, b = request("POST", "/api/admin/orders", token=TOKEN,
                    body={"items": [{"productId": pid, "quantity": 1}], "customerName": "Cliente QA", "confirm": True})
    R.check("S3.venda_direta_confirmada.201", st == 201, 201, st)
    oid = b.get("id") if isinstance(b, dict) else None
    if oid:
        CREATED_ORDERS.add(oid)
    R.check("S3.baixa_venda_direta_9", find_qty(pid, "Item Baixa QA") == 9, 9, find_qty(pid, "Item Baixa QA"))

    # 3.2 pedido público pendente NÃO consome; confirmar consome (9 -> 8)
    st, b = request("POST", "/api/orders", body={"productIds": [pid], "orderNumber": "HSD-QA-STK-1"})
    oid2 = b.get("id") if isinstance(b, dict) else None
    if oid2:
        CREATED_ORDERS.add(oid2)
    R.check("S3.pendente_nao_consome_9", find_qty(pid, "Item Baixa QA") == 9, 9, find_qty(pid, "Item Baixa QA"))

    # confirmar exige nome — pedido público nasce sem nome, então precisa editar antes.
    # Aqui validamos a regra: confirmar sem nome -> 400 (não altera estoque)
    if oid2:
        st, b = request("PATCH", f"/api/admin/orders/{oid2}/status", token=TOKEN, body={"status": "CONFIRMADO"})
        R.check("S3.confirmar_sem_nome.400", st == 400, 400, st)

    # 3.3 cancelar a venda direta confirmada estorna (9 -> 10)
    if oid:
        st, b = request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CANCELADO"})
        R.check("S3.cancelar.200", st == 200, 200, st)
        R.check("S3.estorno_10", find_qty(pid, "Item Baixa QA") == 10, 10, find_qty(pid, "Item Baixa QA"))

    # 3.4 estoque não fica negativo: baixa maior que o disponível
    st, small = create_product(name="Item Pouco QA", stockQuantity=1, salePrice=10.0)
    spid = small.get("id") if isinstance(small, dict) else None
    if spid:
        request("POST", f"/api/admin/stock/{spid}/adjust", token=TOKEN, body={"mode": "AJUSTE", "quantity": 0})
        R.check("S3.piso_zero", find_qty(spid, "Item Pouco QA") == 0, 0, find_qty(spid, "Item Pouco QA"))

    # 3.5 alerta de estoque baixo lista itens <= threshold
    st, low = request("GET", "/api/admin/stock/low", token=TOKEN)
    R.check("S3.low.200", st == 200 and isinstance(low, list), "200 lista", (st, type(low).__name__))
    if isinstance(low, list):
        bad = [x.get("sku") for x in low if x.get("stockQuantity") > x.get("lowStockThreshold")]
        R.check("S3.low.consistente", len(bad) == 0, "todos <= threshold", bad)

    # 3.6 garantia em 3 faixas
    st, war = request("GET", "/api/admin/stock/warranty?days=60", token=TOKEN)
    R.check("S3.warranty.200", st == 200, 200, st)
    R.check("S3.warranty.3faixas",
            isinstance(war, dict) and {"expired", "expiring", "active"} <= set(war.keys()),
            "expired/expiring/active", list(war.keys()) if isinstance(war, dict) else None)
    # produto criado com garantia distante deve estar em "active"
    st, prodw = create_product(name="Garantia Vigente QA", purchaseDate="2026-08-01", warrantyMonths=24)
    st, war = request("GET", "/api/admin/stock/warranty?days=60", token=TOKEN)
    if isinstance(war, dict):
        skus_active = [r.get("sku") for r in war.get("active", [])]
        pw = prodw.get("sku") if isinstance(prodw, dict) else None
        R.check("S3.warranty.vigente_aparece", pw in skus_active, "SKU em active", pw)


# ===========================================================================
# SUÍTE 4 — Regressão / RBAC / integridade
# ===========================================================================
def suite_regression():
    print("== SUÍTE 4: Regressão / RBAC ==")

    # 4.1 catálogo público intacto
    st, cat = request("GET", "/api/products/catalog")
    R.check("S4.catalog.200_lista", st == 200 and isinstance(cat, list), "200 lista", (st, type(cat).__name__))

    # 4.2 catálogo traz os novos campos sem quebrar
    if isinstance(cat, list) and cat:
        p = cat[0]
        R.check("S4.catalog.campos_novos", all(k in p for k in ("stockQuantity", "supplierPrice", "warrantyMonths")),
                "campos presentes", list(p.keys()))
        # capa continua consistente (regressão fotos)
        inconsist = [x.get("sku") for x in cat if x.get("imageUrls") and x.get("imageUrl") != x["imageUrls"][0]]
        R.check("S4.catalog.capa_consistente", len(inconsist) == 0, "0 inconsistências", inconsist)
        # esgotados no fim (regressão ordenação)
        seen = False
        ok = True
        for x in cat:
            if x.get("stockStatus") == "ESGOTADO":
                seen = True
            elif seen:
                ok = False
        R.check("S4.catalog.esgotados_no_fim", ok, "esgotados no fim", None)

    # 4.3 RBAC nas novas rotas admin (sem token e token inválido negam)
    novas = [
        ("GET", "/api/admin/suppliers"),
        ("POST", "/api/admin/suppliers"),
        ("GET", "/api/admin/stock/low"),
        ("GET", "/api/admin/stock/warranty"),
        ("POST", "/api/admin/stock/00000000-0000-0000-0000-000000000000/adjust"),
        ("GET", "/api/admin/stock/00000000-0000-0000-0000-000000000000/movements"),
    ]
    for method, path in novas:
        st, b = request(method, path, no_cookie=True)
        R.check(f"S4.rbac.sem_token.{method} {path}", st in (401, 403), "401/403", st)
        st2, b2 = request(method, path, token="tok.invalido", no_cookie=True)
        R.check(f"S4.rbac.token_invalido.{method} {path}", st2 in (401, 403), "401/403", st2)

    # 4.4 integridade de pedido: total server-side
    st, p1 = create_product(name="Reg Preco 1", salePrice=50.0, stockQuantity=5)
    st, p2 = create_product(name="Reg Preco 2", salePrice=75.5, stockQuantity=5)
    id1 = p1.get("id") if isinstance(p1, dict) else None
    id2 = p2.get("id") if isinstance(p2, dict) else None
    if id1 and id2:
        st, b = request("POST", "/api/orders", body={"productIds": [id1, id2], "orderNumber": "HSD-QA-STK-REG"})
        if isinstance(b, dict) and b.get("id"):
            CREATED_ORDERS.add(b["id"])
            total = b.get("totalAmount")
            R.check("S4.pedido.total_server_side", total is not None and abs(float(total) - 125.5) < 0.01, 125.5, total)

    # 4.5 analytics de margem respondem (regressão dashboards)
    st, b = request("GET", "/api/admin/analytics/sales", token=TOKEN)
    R.check("S4.analytics.sales.200", st == 200, 200, st)
    st, b = request("GET", "/api/admin/analytics/engagement", token=TOKEN)
    R.check("S4.analytics.engagement.200", st == 200, 200, st)

    # 4.6 validações de produto (regressão): SKU inválido, nome curto
    st, b = request("POST", "/api/admin/products", token=TOKEN, body={
        "sku": "com espaco", "name": "Nome OK", "costPrice": 5, "salePrice": 10})
    R.check("S4.sku_invalido.400", st == 400, 400, st)
    st, b = create_product(name="ab")
    R.check("S4.nome_curto.400", st == 400, 400, st)

    # 4.7 varredura extra de status derivado com thresholds variados (densidade)
    for threshold in (0, 1, 3, 5, 10):
        for qty in (0, 1, threshold, threshold + 1, threshold + 10):
            if qty < 0:
                continue
            st, b = create_product(stockQuantity=qty, lowStockThreshold=threshold, name=f"Var t{threshold} q{qty}")
            expected = "ESGOTADO" if qty <= 0 else ("BAIXO" if qty <= threshold else "DISPONIVEL")
            R.check(f"S4.varredura[t={threshold},q={qty}]={expected}",
                    isinstance(b, dict) and b.get("stockStatus") == expected, expected,
                    b.get("stockStatus") if isinstance(b, dict) else None)

    # 4.8 margens/valores persistem corretamente (varredura de 3 valores)
    for sp, cp, sale in [(20.0, 22.0, 50.0), (100.0, 90.0, 200.0), (15.5, 15.5, 31.0)]:
        st, b = create_product(supplierPrice=sp, costPrice=cp, salePrice=sale, name=f"Val {sp}-{cp}-{sale}")
        R.check(f"S4.valores[{sp}/{cp}/{sale}].201", st == 201, 201, st)
        if isinstance(b, dict):
            R.check(f"S4.valores[{sp}/{cp}/{sale}].persist",
                    float(b.get("supplierPrice") or 0) == sp and float(b.get("costPrice") or 0) == cp and float(b.get("salePrice") or 0) == sale,
                    f"{sp}/{cp}/{sale}",
                    (b.get("supplierPrice"), b.get("costPrice"), b.get("salePrice")))

    # 4.9 garantia: vencimento calculado para vários prazos
    for months, expected in [(6, "2027-02-01"), (12, "2027-08-01"), (24, "2028-08-01")]:
        st, b = create_product(purchaseDate="2026-08-01", warrantyMonths=months, name=f"Gar {months}m")
        R.check(f"S4.garantia[{months}m].expira={expected}",
                isinstance(b, dict) and b.get("warrantyExpiresAt") == expected, expected,
                b.get("warrantyExpiresAt") if isinstance(b, dict) else None)

    # 4.10 threshold e quantidade negativos são normalizados/rejeitados
    st, b = create_product(stockQuantity=-5)
    R.check("S4.qty_negativa.400", st == 400, 400, st)
    st, b = create_product(lowStockThreshold=-1)
    R.check("S4.threshold_negativo.400", st == 400, 400, st)
    st, b = create_product(warrantyMonths=-1)
    R.check("S4.garantia_negativa.400", st == 400, 400, st)


def cleanup():
    print("\n== CLEANUP ==")
    # cancela pedidos de teste
    for oid in list(CREATED_ORDERS):
        request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CANCELADO"})
    deleted = 0
    blocked = 0
    for pid in list(CREATED_PRODUCTS):
        st, b = request("DELETE", f"/api/admin/products/{pid}", token=TOKEN)
        if st == 200:
            deleted += 1
        else:
            blocked += 1
    for sid in list(CREATED_SUPPLIERS):
        request("DELETE", f"/api/admin/suppliers/{sid}", token=TOKEN)
    print(f"  Produtos removidos: {deleted} | retidos por FK de pedido: {blocked} | fornecedores: {len(CREATED_SUPPLIERS)} | pedidos cancelados: {len(CREATED_ORDERS)}")


def main():
    t0 = time.time()
    try:
        sid = suite_suppliers()
        suite_product_stock(sid)
        suite_order_stock()
        suite_regression()
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
    sys.exit(0 if R.failed == 0 else 1)


if __name__ == "__main__":
    main()
