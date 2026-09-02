#!/usr/bin/env python3
"""
Bateria de QA da LEVA: usuários, mensagens (WhatsApp), telefone obrigatório em
confirmar/cancelar, preço promocional no catálogo e carrossel sem esgotado.
Perfil: QA sênior. Cobre com muitas variações e limpa 100% dos dados ao final.

Parametrizável por env: QA_BASE, QA_ADMIN_EMAIL, QA_ADMIN_PASS, QA_DB.
Sem dependências externas (stdlib).
"""
import json
import os
import sys
import time
import subprocess
import urllib.request
import urllib.error
import http.cookiejar

BASE = os.environ.get("QA_BASE", "http://localhost:8081")
ADMIN_EMAIL = os.environ.get("QA_ADMIN_EMAIL", "admin@homolog.com")
ADMIN_PASS = os.environ.get("QA_ADMIN_PASS", "homolog123")
DB = os.environ.get("QA_DB", "hesed_homolog")

# Marcadores para limpeza segura ao final.
TEST_EMAIL_TAG = "qaleva"  # e-mails de usuários de teste contêm isto
CREATED_USER_IDS = set()
CREATED_ORDER_IDS = set()
CREATED_PROMO_IDS = set()
TOUCHED_TEMPLATES = {}  # key -> (body, active) original para restaurar


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
_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))


def request(method, path, body=None, no_cookie=False, jar_opener=None):
    url = BASE + path
    data = None
    hdrs = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    opener = urllib.request.urlopen if no_cookie else (jar_opener or _opener).open
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


def login_main():
    st, b = request("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if st != 200:
        print(f"FATAL: login admin falhou (status={st}, body={b})")
        sys.exit(1)


def uniq():
    return f"{int(time.time() * 1000000) % 1000000000}"


# ===========================================================================
# U — Usuários (/api/admin/users)
# ===========================================================================
def suite_usuarios():
    print("== SUÍTE U: Usuários ==")

    # RBAC: sem sessão
    for method, path, body in [
        ("GET", "/api/admin/users", None),
        ("POST", "/api/admin/users", {"name": "X", "email": "x@x.com", "password": "123456", "role": "ROLE_OPERATOR"}),
    ]:
        st, _ = request(method, path, body=body, no_cookie=True)
        R.check(f"U.rbac.sem_sessao.{method}", st in (401, 403), "401/403", st)

    # Criar operador válido
    email = f"op.{TEST_EMAIL_TAG}.{uniq()}@ex.com"
    st, b = request("POST", "/api/admin/users",
                    body={"name": "Operador QA", "email": email, "phone": "(51) 98888-7777",
                          "password": "senha123", "role": "ROLE_OPERATOR"})
    R.check("U.criar.201", st == 201, 201, st)
    opid = b.get("id") if isinstance(b, dict) else None
    if opid:
        CREATED_USER_IDS.add(opid)
    R.check("U.criar.sem_senha_no_response", isinstance(b, dict) and "password" not in b,
            "sem campo password", list(b.keys()) if isinstance(b, dict) else b)
    R.check("U.criar.role_ok", isinstance(b, dict) and b.get("role") == "ROLE_OPERATOR", "ROLE_OPERATOR",
            b.get("role") if isinstance(b, dict) else b)

    # E-mail duplicado
    st, _ = request("POST", "/api/admin/users",
                    body={"name": "Dup", "email": email, "password": "senha123", "role": "ROLE_OPERATOR"})
    R.check("U.email_duplicado.400", st == 400, 400, st)

    # E-mail duplicado case-insensitive
    st, _ = request("POST", "/api/admin/users",
                    body={"name": "Dup2", "email": email.upper(), "password": "senha123", "role": "ROLE_OPERATOR"})
    R.check("U.email_duplicado_case.400", st == 400, 400, st)

    # Senha obrigatória / curta
    st, _ = request("POST", "/api/admin/users",
                    body={"name": "SemSenha", "email": f"s.{TEST_EMAIL_TAG}.{uniq()}@ex.com", "role": "ROLE_OPERATOR"})
    R.check("U.sem_senha.400", st == 400, 400, st)
    st, _ = request("POST", "/api/admin/users",
                    body={"name": "Curta", "email": f"c.{TEST_EMAIL_TAG}.{uniq()}@ex.com", "password": "123", "role": "ROLE_OPERATOR"})
    R.check("U.senha_curta.400", st == 400, 400, st)

    # Papel inválido / e-mail malformado
    st, _ = request("POST", "/api/admin/users",
                    body={"name": "Papel", "email": f"p.{TEST_EMAIL_TAG}.{uniq()}@ex.com", "password": "senha123", "role": "ROLE_GOD"})
    R.check("U.papel_invalido.400", st == 400, 400, st)
    for em in ["semarroba", "a@", "@x.com", "a b@x.com"]:
        st, _ = request("POST", "/api/admin/users",
                        body={"name": "Mail", "email": em, "password": "senha123", "role": "ROLE_OPERATOR"})
        R.check(f"U.email_malformado[{em}].400", st == 400, 400, st)

    # Login com o novo operador (jar isolado) + RBAC dele
    op_jar = http.cookiejar.CookieJar()
    op_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(op_jar))
    st, b = request("POST", "/api/auth/login", body={"email": email, "password": "senha123"}, jar_opener=op_opener)
    R.check("U.novo_operador.login.200", st == 200, 200, st)
    st, _ = request("GET", "/api/admin/users", jar_opener=op_opener)
    R.check("U.operador.bloqueado_users.403", st == 403, 403, st)

    # Update: senha em branco mantém; troca funciona
    st, _ = request("PUT", f"/api/admin/users/{opid}",
                    body={"name": "Operador QA Editado", "email": email, "password": "", "role": "ROLE_OPERATOR"})
    R.check("U.update.senha_branco.200", st == 200, 200, st)
    st, _ = request("POST", "/api/auth/login", body={"email": email, "password": "senha123"},
                    jar_opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())))
    R.check("U.update.senha_mantida.login200", st == 200, 200, st)
    st, _ = request("PUT", f"/api/admin/users/{opid}",
                    body={"name": "Operador QA Editado", "email": email, "password": "novaSenha9", "role": "ROLE_OPERATOR"})
    R.check("U.update.troca_senha.200", st == 200, 200, st)
    st, _ = request("POST", "/api/auth/login", body={"email": email, "password": "novaSenha9"},
                    jar_opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())))
    R.check("U.update.nova_senha.login200", st == 200, 200, st)

    # Autoproteção do admin logado: descobrir seu id
    st, me = request("GET", "/api/auth/me")
    admin_id = me.get("id") if isinstance(me, dict) else None
    if admin_id:
        st, _ = request("PUT", f"/api/admin/users/{admin_id}",
                        body={"name": "Admin", "email": ADMIN_EMAIL, "password": "", "role": "ROLE_OPERATOR"})
        R.check("U.autorrebaixar.400", st == 400, 400, st)
        st, _ = request("DELETE", f"/api/admin/users/{admin_id}")
        R.check("U.autoexcluir.400", st == 400, 400, st)

    # Último admin: como só há 1 admin (o logado), rebaixá-lo via autoproteção já cobre.
    # Criar um 2º admin, rebaixá-lo é permitido (há outros), e excluir operador funciona.
    st, b = request("POST", "/api/admin/users",
                    body={"name": "Admin2 QA", "email": f"adm.{TEST_EMAIL_TAG}.{uniq()}@ex.com",
                          "password": "senha123", "role": "ROLE_ADMIN"})
    adm2 = b.get("id") if isinstance(b, dict) else None
    if adm2:
        CREATED_USER_IDS.add(adm2)
    R.check("U.criar_admin2.201", st == 201, 201, st)
    # excluir operador -> 200
    st, _ = request("DELETE", f"/api/admin/users/{opid}")
    R.check("U.excluir_operador.200", st == 200, 200, st)
    if st == 200:
        CREATED_USER_IDS.discard(opid)


# ===========================================================================
# T — Templates de mensagem (/api/admin/settings/messages)
# ===========================================================================
def suite_templates():
    print("== SUÍTE T: Mensagens ==")

    st, b = request("GET", "/api/admin/settings/messages")
    R.check("T.get.200", st == 200, 200, st)
    keys = {t["templateKey"] for t in b} if isinstance(b, list) else set()
    R.check("T.tem_confirmado_cancelado",
            {"ORDER_CONFIRMED", "ORDER_CANCELLED"}.issubset(keys), "ambos os templates", keys)

    # Guarda originais para restaurar (body, active, imageUrl)
    if isinstance(b, list):
        for t in b:
            TOUCHED_TEMPLATES.setdefault(t["templateKey"], (t["body"], t["active"], t.get("imageUrl")))

    # RBAC
    st, _ = request("GET", "/api/admin/settings/messages", no_cookie=True)
    R.check("T.rbac.sem_sessao.403", st in (401, 403), "401/403", st)

    # PUT válido
    st, b = request("PUT", "/api/admin/settings/messages/ORDER_CONFIRMED",
                    body={"body": "Oi {cliente}! Pedido {pedido} - {total}. Itens: {itens}", "active": True})
    R.check("T.put.200", st == 200, 200, st)
    R.check("T.put.body_atualizado",
            isinstance(b, dict) and b.get("body", "").startswith("Oi {cliente}"), "body novo", b.get("body") if isinstance(b, dict) else b)

    # PUT body vazio -> 400
    st, _ = request("PUT", "/api/admin/settings/messages/ORDER_CONFIRMED", body={"body": "   ", "active": True})
    R.check("T.put.body_vazio.400", st == 400, 400, st)

    # PUT key inexistente -> 400
    st, _ = request("PUT", "/api/admin/settings/messages/NAO_EXISTE", body={"body": "x", "active": True})
    R.check("T.put.key_inexistente.400", st == 400, 400, st)

    # Imagem opcional: salvar imageUrl
    img = "https://hesedsemijoias.online/uploads/qa-cuidados.jpg"
    st, b = request("PUT", "/api/admin/settings/messages/ORDER_CONFIRMED",
                    body={"body": "Oi {cliente}!", "active": True, "imageUrl": img})
    R.check("T.img.salva.200", st == 200, 200, st)
    R.check("T.img.retorna_url", isinstance(b, dict) and b.get("imageUrl") == img, img,
            b.get("imageUrl") if isinstance(b, dict) else b)
    # GET reflete a imagem
    st, lst = request("GET", "/api/admin/settings/messages")
    t = next((x for x in lst if x["templateKey"] == "ORDER_CONFIRMED"), {}) if isinstance(lst, list) else {}
    R.check("T.img.get_reflete", t.get("imageUrl") == img, img, t.get("imageUrl"))
    # imageUrl em branco -> null (imagem removida)
    st, b = request("PUT", "/api/admin/settings/messages/ORDER_CONFIRMED",
                    body={"body": "Oi {cliente}!", "active": True, "imageUrl": "   "})
    R.check("T.img.branco_vira_null", isinstance(b, dict) and b.get("imageUrl") in (None, ""), None,
            b.get("imageUrl") if isinstance(b, dict) else b)
    # imageUrl acima de 500 chars -> 400
    st, _ = request("PUT", "/api/admin/settings/messages/ORDER_CONFIRMED",
                    body={"body": "x", "active": True, "imageUrl": "h" * 600})
    R.check("T.img.muito_longa.400", st == 400, 400, st)
    # sem imageUrl no request -> continua válido (opcional)
    st, _ = request("PUT", "/api/admin/settings/messages/ORDER_CONFIRMED",
                    body={"body": "Oi {cliente}!", "active": True})
    R.check("T.img.opcional.200", st == 200, 200, st)

    # Toggle inativo e reativar
    st, _ = request("PUT", "/api/admin/settings/messages/ORDER_CANCELLED",
                    body={"body": TOUCHED_TEMPLATES.get("ORDER_CANCELLED", ("msg", True))[0] or "Cancelado {pedido}", "active": False})
    R.check("T.toggle.inativo.200", st == 200, 200, st)


# ===========================================================================
# P — Pedidos: telefone obrigatório confirmar/cancelar
# ===========================================================================
def _first_available_product():
    st, cat = request("GET", "/api/products/catalog", no_cookie=True)
    if isinstance(cat, list):
        for p in cat:
            if p.get("stockStatus") != "ESGOTADO":
                return p
    return None


def suite_pedidos_telefone():
    print("== SUÍTE P: Telefone obrigatório (confirmar/cancelar) ==")
    prod = _first_available_product()
    if not prod:
        R.check("P.tem_produto", False, "produto disponível", None)
        return

    def novo_pedido():
        st, b = request("POST", "/api/admin/orders",
                        body={"items": [{"productId": prod["id"], "quantity": 1}], "confirm": False})
        if st in (200, 201) and isinstance(b, dict):
            CREATED_ORDER_IDS.add(b["id"])
            return b["id"]
        return None

    # Confirmar sem nome -> 400
    oid = novo_pedido()
    st, _ = request("PATCH", f"/api/admin/orders/{oid}/status", body={"status": "CONFIRMADO"})
    R.check("P.confirmar_sem_nome.400", st == 400, 400, st)
    # Só nome, sem telefone -> 400
    request("PUT", f"/api/admin/orders/{oid}", body={"items": [{"productId": prod["id"], "quantity": 1}], "customerName": "Cliente QA"})
    st, _ = request("PATCH", f"/api/admin/orders/{oid}/status", body={"status": "CONFIRMADO"})
    R.check("P.confirmar_so_nome.400", st == 400, 400, st)
    # Cancelar só com nome -> 400 (telefone obrigatório também no cancelamento)
    st, _ = request("PATCH", f"/api/admin/orders/{oid}/status", body={"status": "CANCELADO"})
    R.check("P.cancelar_so_nome.400", st == 400, 400, st)
    # Com nome + telefone -> confirma 200
    request("PUT", f"/api/admin/orders/{oid}", body={"items": [{"productId": prod["id"], "quantity": 1}],
                                                     "customerName": "Cliente QA", "customerPhone": "51988887777"})
    st, _ = request("PATCH", f"/api/admin/orders/{oid}/status", body={"status": "CONFIRMADO"})
    R.check("P.confirmar_completo.200", st == 200, 200, st)

    # Outro pedido: cancelar com nome+telefone -> 200
    oid2 = novo_pedido()
    request("PUT", f"/api/admin/orders/{oid2}", body={"items": [{"productId": prod["id"], "quantity": 1}],
                                                      "customerName": "Cliente QA2", "customerPhone": "51988887777"})
    st, _ = request("PATCH", f"/api/admin/orders/{oid2}/status", body={"status": "CANCELADO"})
    R.check("P.cancelar_completo.200", st == 200, 200, st)


# ===========================================================================
# C — Catálogo: preço promocional e carrossel sem esgotado
# ===========================================================================
def suite_catalogo_promo():
    print("== SUÍTE C: Preço promocional + carrossel ==")
    prod = _first_available_product()
    if not prod:
        R.check("C.tem_produto", False, "produto disponível", None)
        return
    pid = prod["id"]
    sale = float(prod["salePrice"])

    # Sem promo: effectivePrice == salePrice, onSale False
    R.check("C.sem_promo.effective_igual_sale", abs(float(prod["effectivePrice"]) - sale) < 0.001,
            sale, prod["effectivePrice"])
    R.check("C.sem_promo.onSale_false", prod.get("onSale") is False, False, prod.get("onSale"))

    # Cria promo 25%
    st, b = request("POST", "/api/admin/promotions",
                    body={"productId": pid, "title": f"QA Leva Promo {uniq()}", "discountPercent": 25, "active": True})
    R.check("C.cria_promo.201", st == 201, 201, st)
    promoid = b.get("id") if isinstance(b, dict) else None
    if promoid:
        CREATED_PROMO_IDS.add(promoid)

    # Catálogo reflete desconto
    st, cat = request("GET", "/api/products/catalog", no_cookie=True)
    pc = next((x for x in cat if x["id"] == pid), None) if isinstance(cat, list) else None
    expected = round(sale * 0.75, 2)
    R.check("C.com_promo.onSale_true", pc and pc.get("onSale") is True, True, pc.get("onSale") if pc else None)
    R.check("C.com_promo.effectivePrice", pc and abs(float(pc["effectivePrice"]) - expected) < 0.01,
            expected, pc.get("effectivePrice") if pc else None)

    # Pedido registra o mesmo valor do catálogo
    st, ord_ = request("POST", "/api/orders", body={"productIds": [pid], "orderNumber": f"HSD-QALEVA-{uniq()}"}, no_cookie=True)
    if st in (200, 201) and isinstance(ord_, dict):
        CREATED_ORDER_IDS.add(ord_["id"])
        item = ord_["items"][0]
        R.check("C.pedido.effectivePrice_bate", abs(float(item["effectivePrice"]) - expected) < 0.01,
                expected, item["effectivePrice"])
        R.check("C.pedido.total_bate", abs(float(ord_["totalAmount"]) - expected) < 0.01,
                expected, ord_["totalAmount"])
        R.check("C.pedido.wasPromotion", item.get("wasPromotion") is True, True, item.get("wasPromotion"))

    # Carrossel: produto disponível com promo aparece
    st, promos = request("GET", "/api/promotions", no_cookie=True)
    skus_no_carrossel = {p["productSku"] for p in promos} if isinstance(promos, list) else set()
    R.check("C.carrossel.mostra_disponivel", prod["sku"] in skus_no_carrossel, prod["sku"], skus_no_carrossel)
    # Nenhum produto do carrossel está esgotado (cruza com catálogo)
    cat_status = {x["id"]: x["stockStatus"] for x in cat} if isinstance(cat, list) else {}
    esgotado_no_carrossel = any(
        cat_status.get(p["productId"]) == "ESGOTADO" for p in promos
    ) if isinstance(promos, list) else False
    R.check("C.carrossel.sem_esgotado", not esgotado_no_carrossel, "nenhum esgotado", esgotado_no_carrossel)

    # Admin vê a promo mesmo assim
    st, adm = request("GET", "/api/admin/promotions")
    R.check("C.admin.ve_promo", isinstance(adm, list) and any(p.get("id") == promoid for p in adm),
            "promo visível ao admin", None)


# ===========================================================================
# Cleanup
# ===========================================================================
def cleanup():
    print("\n== CLEANUP ==")
    # Cancela pedidos de teste que ficaram confirmados (estorna estoque via serviço),
    # depois remove via SQL (pedidos + itens + movimentos).
    for oid in list(CREATED_ORDER_IDS):
        request("PATCH", f"/api/admin/orders/{oid}/status", body={"status": "CANCELADO"})

    # Remove promoções de teste via API
    for pr in list(CREATED_PROMO_IDS):
        request("DELETE", f"/api/admin/promotions/{pr}")

    # Restaura templates alterados (body, active, imageUrl)
    for key, orig in TOUCHED_TEMPLATES.items():
        body, active = orig[0], orig[1]
        image_url = orig[2] if len(orig) > 2 else None
        request("PUT", f"/api/admin/settings/messages/{key}",
                body={"body": body, "active": active, "imageUrl": image_url})

    # SQL: remove usuários de teste, pedidos de teste e seus vínculos
    order_ids = "','".join(CREATED_ORDER_IDS)
    sql = []
    if CREATED_ORDER_IDS:
        sql.append(f"DELETE FROM order_items WHERE order_id IN ('{order_ids}');")
        sql.append(f"DELETE FROM stock_movements WHERE order_id IN ('{order_ids}');")
        sql.append(f"DELETE FROM orders WHERE id IN ('{order_ids}');")
    sql.append(f"DELETE FROM users WHERE email LIKE '%{TEST_EMAIL_TAG}%';")
    r = subprocess.run(["psql", "-d", DB, "-c", " ".join(sql)], capture_output=True, text=True)
    print(f"  psql cleanup rc={r.returncode} {r.stdout.strip()} {r.stderr.strip()}")

    # Verificações de não-vazamento
    st, users = request("GET", "/api/admin/users")
    leaked_u = [u for u in users if TEST_EMAIL_TAG in u.get("email", "")] if isinstance(users, list) else ["?"]
    R.check("CLEANUP.sem_usuarios_teste", len(leaked_u) == 0, 0, len(leaked_u))

    st, promos = request("GET", "/api/admin/promotions")
    leaked_p = [p for p in promos if p.get("id") in CREATED_PROMO_IDS] if isinstance(promos, list) else ["?"]
    R.check("CLEANUP.sem_promos_teste", len(leaked_p) == 0, 0, len(leaked_p))


def main():
    t0 = time.time()
    login_main()
    print("Login admin homolog OK. Iniciando bateria da LEVA...\n")
    try:
        suite_usuarios()
        suite_templates()
        suite_pedidos_telefone()
        suite_catalogo_promo()
    finally:
        cleanup()
    dt = time.time() - t0
    total = R.passed + R.failed
    print("\n" + "=" * 60)
    print(f"LEVA — TOTAL: {total} | PASS: {R.passed} | FAIL: {R.failed} | {dt:.1f}s")
    print("=" * 60)
    if R.failures:
        print("\nFALHAS:")
        for name, exp, got in R.failures:
            print(f"  - {name}: esperado={exp} obtido={got}")
    sys.exit(0 if R.failed == 0 else 1)


if __name__ == "__main__":
    main()
