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
from urllib.parse import quote

BASE = os.environ.get("QA_BASE", "http://localhost:8081")
ADMIN_EMAIL = os.environ.get("QA_ADMIN_EMAIL", "admin@homolog.com")
ADMIN_PASS = os.environ.get("QA_ADMIN_PASS", "homolog123")
DB = os.environ.get("QA_DB", "hesed_homolog")

# Marcadores para limpeza segura ao final.
TEST_EMAIL_TAG = "qaleva"  # e-mails de usuários de teste contêm isto
CREATED_USER_IDS = set()
CREATED_ORDER_IDS = set()
CREATED_PROMO_IDS = set()
CREATED_CUSTOMER_IDS = set()
CREATED_PRODUCT_IDS = set()
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
# CL — Clientes (/api/admin/customers) + vínculo no pedido
# ===========================================================================
def suite_clientes():
    print("== SUÍTE CL: Clientes ==")

    # RBAC sem sessão
    for method, path, body in [
        ("GET", "/api/admin/customers", None),
        ("POST", "/api/admin/customers", {"name": "X", "phone": "51999998888"}),
    ]:
        st, _ = request(method, path, body=body, no_cookie=True)
        R.check(f"CL.rbac.sem_sessao.{method}", st in (401, 403), "401/403", st)

    # Criar cliente válido (telefone formatado deve ser aceito)
    email = f"cli.{TEST_EMAIL_TAG}.{uniq()}@ex.com"
    st, b = request("POST", "/api/admin/customers",
                    body={"name": "Maria QA Cliente", "phone": "(51) 98888-7777",
                          "email": email, "notes": "Prefere dourado"})
    R.check("CL.criar.201", st == 201, 201, st)
    cid = b.get("id") if isinstance(b, dict) else None
    if cid:
        CREATED_CUSTOMER_IDS.add(cid)
    R.check("CL.criar.retorna_campos",
            isinstance(b, dict) and b.get("name") == "Maria QA Cliente" and b.get("notes") == "Prefere dourado",
            "campos ok", b)

    # Telefones válidos variados (aceita fixo, celular, com/sem máscara)
    for tel in ["51988887777", "(51) 3333-0000", "51 98888 7777", "(51)988887777"]:
        e = f"cli.{TEST_EMAIL_TAG}.{uniq()}@ex.com"
        st, b2 = request("POST", "/api/admin/customers", body={"name": "Tel QA", "phone": tel, "email": e})
        R.check(f"CL.tel_valido[{tel}].201", st == 201, 201, st)
        if isinstance(b2, dict) and b2.get("id"):
            CREATED_CUSTOMER_IDS.add(b2["id"])

    # Telefones inválidos -> 400
    for tel in ["123", "abc", "98888-7777"]:
        st, _ = request("POST", "/api/admin/customers",
                        body={"name": "Tel Ruim", "phone": tel, "email": f"x.{TEST_EMAIL_TAG}.{uniq()}@ex.com"})
        R.check(f"CL.tel_invalido[{tel}].400", st == 400, 400, st)

    # Nome curto / faltando -> 400
    st, _ = request("POST", "/api/admin/customers", body={"name": "ab", "phone": "51988887777"})
    R.check("CL.nome_curto.400", st == 400, 400, st)
    st, _ = request("POST", "/api/admin/customers", body={"phone": "51988887777"})
    R.check("CL.sem_nome.400", st == 400, 400, st)

    # E-mail duplicado (mesmo e case-insensitive) -> 400
    st, _ = request("POST", "/api/admin/customers", body={"name": "Dup", "phone": "51988887777", "email": email})
    R.check("CL.email_dup.400", st == 400, 400, st)
    st, _ = request("POST", "/api/admin/customers", body={"name": "Dup2", "phone": "51988887777", "email": email.upper()})
    R.check("CL.email_dup_case.400", st == 400, 400, st)

    # Busca por nome e por telefone (URL-encode do termo)
    from urllib.parse import quote
    st, lst = request("GET", f"/api/admin/customers?search={quote('Maria QA')}")
    R.check("CL.busca_nome", isinstance(lst, list) and any(c.get("id") == cid for c in lst), "acha por nome", None)
    st, lst = request("GET", "/api/admin/customers?search=98888")
    R.check("CL.busca_telefone", isinstance(lst, list) and len(lst) >= 1, ">=1", len(lst) if isinstance(lst, list) else None)

    # Editar
    st, b = request("PUT", f"/api/admin/customers/{cid}",
                    body={"name": "Maria QA Editada", "phone": "(51) 98888-7777", "email": email, "notes": "VIP"})
    R.check("CL.editar.200", st == 200, 200, st)
    R.check("CL.editar.aplicado", isinstance(b, dict) and b.get("name") == "Maria QA Editada" and b.get("notes") == "VIP",
            "editado", b)

    # Not found
    st, _ = request("GET", f"/api/admin/customers/{uniq()}0000-0000")
    R.check("CL.getById.invalido", st in (400, 404), "400/404", st)

    # --- Vínculo no pedido: venda direta só com customerId preenche snapshot ---
    prod = _first_available_product()
    if prod and cid:
        st, ord_ = request("POST", "/api/admin/orders",
                           body={"items": [{"productId": prod["id"], "quantity": 1}], "customerId": cid, "confirm": False})
        R.check("CL.pedido.criar_com_customerId.201", st in (200, 201), "200/201", st)
        if isinstance(ord_, dict) and ord_.get("id"):
            CREATED_ORDER_IDS.add(ord_["id"])
            R.check("CL.pedido.customerId_vinculado", ord_.get("customerId") == cid, cid, ord_.get("customerId"))
            R.check("CL.pedido.snapshot_nome", ord_.get("customerName") == "Maria QA Editada",
                    "Maria QA Editada", ord_.get("customerName"))
            R.check("CL.pedido.snapshot_fone", (ord_.get("customerPhone") or "").replace(" ", "") != "",
                    "telefone preenchido", ord_.get("customerPhone"))
            # Confirmar funciona: o vínculo já satisfez nome+telefone
            st, _ = request("PATCH", f"/api/admin/orders/{ord_['id']}/status", body={"status": "CONFIRMADO"})
            R.check("CL.pedido.confirma_com_cliente.200", st == 200, 200, st)

    # Catálogo público inalterado (não exige cliente)
    if prod:
        st, ord_ = request("POST", "/api/orders",
                           body={"productIds": [prod["id"]], "orderNumber": f"HSD-QALEVA-CLI-{uniq()}"}, no_cookie=True)
        R.check("CL.catalogo_publico_inalterado.201", st in (200, 201), "200/201", st)
        if isinstance(ord_, dict) and ord_.get("id"):
            CREATED_ORDER_IDS.add(ord_["id"])
            R.check("CL.catalogo_publico_sem_cliente", ord_.get("customerId") is None, None, ord_.get("customerId"))

    # Excluir um cliente de teste -> 200
    if cid:
        st, _ = request("DELETE", f"/api/admin/customers/{cid}")
        # pode estar vinculado a pedido; aceitamos 200 (SET NULL) ou 400 (protegido). Registramos o comportamento.
        R.check("CL.excluir.resposta_valida", st in (200, 400), "200/400", st)
        if st == 200:
            CREATED_CUSTOMER_IDS.discard(cid)


# ===========================================================================
# SE — Produto sob encomenda (onDemand)
# ===========================================================================
def suite_sob_encomenda():
    print("== SUÍTE SE: Sob encomenda ==")

    sku = f"QA-OD-{uniq()}"
    st, b = request("POST", "/api/admin/products",
                    body={"sku": sku, "name": "Sob Encomenda QA", "category": "Corrente",
                          "costPrice": 40, "salePrice": 120, "stockQuantity": 0,
                          "onDemand": True, "leadTimeDays": 10})
    R.check("SE.criar.201", st == 201, 201, st)
    pid = b.get("id") if isinstance(b, dict) else None
    if pid:
        CREATED_PRODUCT_IDS.add(pid)
    R.check("SE.criar.onDemand_true", isinstance(b, dict) and b.get("onDemand") is True, True,
            b.get("onDemand") if isinstance(b, dict) else b)
    R.check("SE.criar.status_disponivel", isinstance(b, dict) and b.get("stockStatus") == "DISPONIVEL",
            "DISPONIVEL", b.get("stockStatus") if isinstance(b, dict) else b)
    R.check("SE.criar.leadTime", isinstance(b, dict) and b.get("leadTimeDays") == 10, 10,
            b.get("leadTimeDays") if isinstance(b, dict) else b)

    # Catálogo público: aparece, comprável (não ESGOTADO), com onDemand + leadTimeDays
    st, cat = request("GET", "/api/products/catalog", no_cookie=True)
    pc = next((x for x in cat if x.get("id") == pid), None) if isinstance(cat, list) else None
    R.check("SE.catalogo.presente", pc is not None, "no catálogo", None)
    if pc:
        R.check("SE.catalogo.nao_esgotado", pc.get("stockStatus") != "ESGOTADO", "!= ESGOTADO", pc.get("stockStatus"))
        R.check("SE.catalogo.onDemand", pc.get("onDemand") is True, True, pc.get("onDemand"))
        R.check("SE.catalogo.leadTime", pc.get("leadTimeDays") == 10, 10, pc.get("leadTimeDays"))

    # Venda direta confirmada NÃO baixa estoque nem gera movimento
    st, ord_ = request("POST", "/api/admin/orders",
                       body={"items": [{"productId": pid, "quantity": 2}],
                             "customerName": "Cliente OD", "customerPhone": "51988887777", "confirm": True})
    R.check("SE.venda.confirmada.201", st in (200, 201), "200/201", st)
    if isinstance(ord_, dict) and ord_.get("id"):
        CREATED_ORDER_IDS.add(ord_["id"])
        R.check("SE.venda.total", abs(float(ord_["totalAmount"]) - 240.0) < 0.01, 240.0, ord_["totalAmount"])

    # Confirma via SQL: estoque continua 0 e não há StockMovement para o produto
    q = subprocess.run(["psql", "-d", DB, "-tAc",
                        f"SELECT stock_quantity FROM products WHERE id='{pid}';"],
                       capture_output=True, text=True)
    R.check("SE.estoque.inalterado_0", q.stdout.strip() == "0", "0", q.stdout.strip())
    m = subprocess.run(["psql", "-d", DB, "-tAc",
                        f"SELECT count(*) FROM stock_movements WHERE product_id='{pid}';"],
                       capture_output=True, text=True)
    R.check("SE.estoque.sem_movimento", m.stdout.strip() == "0", "0", m.stdout.strip())

    # Produto NORMAL com qty 0 continua ESGOTADO (regressão da regra de estoque)
    skun = f"QA-NORM-{uniq()}"
    st, bn = request("POST", "/api/admin/products",
                     body={"sku": skun, "name": "Normal QA", "category": "Brinco",
                           "costPrice": 10, "salePrice": 30, "stockQuantity": 0})
    npid = bn.get("id") if isinstance(bn, dict) else None
    if npid:
        CREATED_PRODUCT_IDS.add(npid)
    R.check("SE.normal.esgotado", isinstance(bn, dict) and bn.get("stockStatus") == "ESGOTADO",
            "ESGOTADO", bn.get("stockStatus") if isinstance(bn, dict) else bn)
    R.check("SE.normal.onDemand_false", isinstance(bn, dict) and bn.get("onDemand") is False, False,
            bn.get("onDemand") if isinstance(bn, dict) else bn)

    # RBAC: criar produto sem sessão nega
    st, _ = request("POST", "/api/admin/products", no_cookie=True,
                    body={"sku": "X", "name": "X", "costPrice": 1, "salePrice": 2})
    R.check("SE.rbac.sem_sessao", st in (401, 403), "401/403", st)


# ===========================================================================
# SD — Dashboard de Estoque (/api/admin/analytics/stock)
# ===========================================================================
def suite_stock_dashboard():
    print("== SUÍTE SD: Dashboard de Estoque ==")

    # RBAC sem sessão
    st, _ = request("GET", "/api/admin/analytics/stock", no_cookie=True)
    R.check("SD.rbac.sem_sessao", st in (401, 403), "401/403", st)

    # Baseline
    st, d = request("GET", "/api/admin/analytics/stock")
    R.check("SD.get.200", st == 200, 200, st)
    if not isinstance(d, dict) or "kpis" not in d:
        R.check("SD.payload", False, "payload com kpis", d)
        return
    k = d["kpis"]

    # Coerência: soma das categorias == KPIs de skus/unidades/custo
    sku_sum = sum(c["skus"] for c in d["byCategory"])
    unit_sum = sum(c["units"] for c in d["byCategory"])
    cost_sum = round(sum(float(c["costValue"]) for c in d["byCategory"]), 2)
    R.check("SD.coerencia.skus", k["skus"] == sku_sum, k["skus"], sku_sum)
    R.check("SD.coerencia.units", k["units"] == unit_sum, k["units"], unit_sum)
    R.check("SD.coerencia.custo", abs(float(k["costValue"]) - cost_sum) < 0.01, k["costValue"], cost_sum)
    R.check("SD.coerencia.status_soma", k["available"] + k["low"] + k["out"] == k["skus"],
            k["skus"], k["available"] + k["low"] + k["out"])
    # Críticos == baixo + esgotado
    R.check("SD.criticos_conta", len(d["critical"]) == k["low"] + k["out"], k["low"] + k["out"], len(d["critical"]))

    baseline_skus = k["skus"]

    # Cria produto SOB ENCOMENDA e confirma que NÃO entra no dashboard
    sku_od = f"QA-OD-SD-{uniq()}"
    st, b = request("POST", "/api/admin/products",
                    body={"sku": sku_od, "name": "OD Dash QA", "category": "Corrente",
                          "costPrice": 50, "salePrice": 150, "stockQuantity": 0,
                          "onDemand": True, "leadTimeDays": 7})
    if isinstance(b, dict) and b.get("id"):
        CREATED_PRODUCT_IDS.add(b["id"])
    st, d2 = request("GET", "/api/admin/analytics/stock")
    R.check("SD.onDemand_fora", isinstance(d2, dict) and d2["kpis"]["skus"] == baseline_skus,
            baseline_skus, d2["kpis"]["skus"] if isinstance(d2, dict) else None)

    # Filtro por categoria restringe o painel
    if d["byCategory"]:
        cat = d["byCategory"][0]["category"]
        st, dc = request("GET", f"/api/admin/analytics/stock?category={quote(cat)}")
        cats = {c["category"] for c in dc["byCategory"]} if isinstance(dc, dict) else set()
        R.check("SD.filtro_categoria", cats <= {cat}, f"apenas {cat}", cats)

    # Filtro por situação restringe os críticos
    st, de = request("GET", "/api/admin/analytics/stock?status=ESGOTADO")
    if isinstance(de, dict):
        st_set = {c["stockStatus"] for c in de["critical"]}
        R.check("SD.filtro_status", st_set <= {"ESGOTADO"}, "apenas ESGOTADO", st_set)
        R.check("SD.filtro_status.disponivel_zero", de["kpis"]["available"] == 0, 0, de["kpis"]["available"])

    # status lowercase normaliza
    st, dl = request("GET", "/api/admin/analytics/stock?status=baixo")
    R.check("SD.status_lowercase", isinstance(dl, dict) and dl.get("kpis") is not None, "kpis ok", None)

    # movementsFrom no futuro zera as movimentações, mas mantém os KPIs
    st, df = request("GET", "/api/admin/analytics/stock?movementsFrom=2099-01-01")
    if isinstance(df, dict):
        R.check("SD.movimentacoes_futuro_zero", len(df["recentMovements"]) == 0, 0, len(df["recentMovements"]))
        R.check("SD.movimentacoes_nao_afeta_kpis", df["kpis"]["skus"] == baseline_skus, baseline_skus, df["kpis"]["skus"])


# ===========================================================================
# PD — Dashboard de Promoções (/api/admin/analytics/promotions)
# ===========================================================================
def suite_promotions_dashboard():
    print("== SUÍTE PD: Dashboard de Promoções ==")

    # RBAC sem sessão
    st, _ = request("GET", "/api/admin/analytics/promotions", no_cookie=True)
    R.check("PD.rbac.sem_sessao", st in (401, 403), "401/403", st)

    # Baseline (todo período)
    st, d = request("GET", "/api/admin/analytics/promotions?from=2000-01-01")
    R.check("PD.get.200", st == 200, 200, st)
    if not isinstance(d, dict) or "kpis" not in d:
        R.check("PD.payload", False, "payload com kpis", d)
        return
    k = d["kpis"]
    s = d["split"]

    # Coerência: KPIs de promoção == split
    R.check("PD.kpi_split_receita", abs(float(k["promoRevenue"]) - float(s["promoRevenue"])) < 0.01,
            s["promoRevenue"], k["promoRevenue"])
    R.check("PD.kpi_split_itens", k["promoItems"] == s["promoItems"], s["promoItems"], k["promoItems"])

    # Participação % = promoRev / (promoRev + regular)
    total = float(s["promoRevenue"]) + float(s["regularRevenue"])
    esperado = round(float(s["promoRevenue"]) * 100 / total, 2) if total else 0
    R.check("PD.participacao", abs(float(k["promoShare"]) - esperado) < 0.01, esperado, k["promoShare"])

    # activeCount == tamanho da lista de ativas
    R.check("PD.ativas_conta", k["activeCount"] == len(d["activePromotions"]),
            len(d["activePromotions"]), k["activeCount"])

    # Desconto concedido >= 0
    R.check("PD.desconto_nao_negativo", float(k["discountGranted"]) >= 0, ">=0", k["discountGranted"])

    # Filtro por categoria: se houver top produtos, filtra por uma categoria deles
    if d["topPromoProducts"]:
        cat = d["topPromoProducts"][0]["category"]
        st, dc = request("GET", f"/api/admin/analytics/promotions?from=2000-01-01&category={quote(cat)}")
        if isinstance(dc, dict):
            cats = {p["category"] for p in dc["topPromoProducts"]}
            R.check("PD.filtro_categoria", cats <= {cat}, f"apenas {cat}", cats)

    # Período futuro: zera vendas, mas mantém as ativas (vigência é "agora")
    st, df = request("GET", "/api/admin/analytics/promotions?from=2099-01-01")
    if isinstance(df, dict):
        R.check("PD.futuro_zera_receita", float(df["kpis"]["promoRevenue"]) == 0, 0, df["kpis"]["promoRevenue"])
        R.check("PD.futuro_share_zero", float(df["kpis"]["promoShare"]) == 0, 0, df["kpis"]["promoShare"])
        R.check("PD.futuro_mantem_ativas", df["kpis"]["activeCount"] == k["activeCount"],
                k["activeCount"], df["kpis"]["activeCount"])


# ===========================================================================
# PF — Filtro de período (intervalo from+to nos dashboards)
# ===========================================================================
def suite_period_filter():
    print("== SUÍTE PF: Filtro de período (from+to) ==")

    # Sales: intervalo amplo tem dados; intervalo futuro zera
    st, amplo = request("GET", "/api/admin/analytics/sales?from=2000-01-01&to=2030-12-31&granularity=month")
    R.check("PF.sales.amplo.200", st == 200, 200, st)
    rev_amplo = float(amplo["kpis"]["revenue"]) if isinstance(amplo, dict) else -1
    st, fut = request("GET", "/api/admin/analytics/sales?from=2099-01-01&to=2099-12-31")
    R.check("PF.sales.futuro_zera", isinstance(fut, dict) and float(fut["kpis"]["revenue"]) == 0,
            0, fut["kpis"]["revenue"] if isinstance(fut, dict) else None)
    # janela até ontem não pode ser maior que o todo período (sanidade)
    R.check("PF.sales.amplo_tem_ou_zero", rev_amplo >= 0, ">=0", rev_amplo)

    # Stock: movementsFrom+movementsTo — intervalo amplo vs futuro
    st, sAmplo = request("GET", "/api/admin/analytics/stock?movementsFrom=2000-01-01&movementsTo=2030-12-31")
    st, sFut = request("GET", "/api/admin/analytics/stock?movementsFrom=2099-01-01&movementsTo=2099-12-31")
    if isinstance(sAmplo, dict) and isinstance(sFut, dict):
        R.check("PF.stock.futuro_zera_movs", len(sFut["recentMovements"]) == 0, 0, len(sFut["recentMovements"]))
        R.check("PF.stock.kpis_inalterado", sFut["kpis"]["skus"] == sAmplo["kpis"]["skus"],
                sAmplo["kpis"]["skus"], sFut["kpis"]["skus"])
        R.check("PF.stock.amplo_movs_maior_igual", len(sAmplo["recentMovements"]) >= len(sFut["recentMovements"]),
                ">=", None)

    # Promotions: from+to — futuro zera vendas mas mantém ativas
    st, pAmplo = request("GET", "/api/admin/analytics/promotions?from=2000-01-01&to=2030-12-31")
    st, pFut = request("GET", "/api/admin/analytics/promotions?from=2099-01-01&to=2099-12-31")
    if isinstance(pAmplo, dict) and isinstance(pFut, dict):
        R.check("PF.promo.futuro_zera_receita", float(pFut["kpis"]["promoRevenue"]) == 0, 0, pFut["kpis"]["promoRevenue"])
        R.check("PF.promo.futuro_mantem_ativas", pFut["kpis"]["activeCount"] == pAmplo["kpis"]["activeCount"],
                pAmplo["kpis"]["activeCount"], pFut["kpis"]["activeCount"])

    # Intervalo de um único dia (from==to) é aceito (não quebra)
    st, umDia = request("GET", "/api/admin/analytics/sales?from=2000-06-15&to=2000-06-15")
    R.check("PF.sales.um_dia.200", st == 200, 200, st)


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

    # SQL: remove usuários de teste, pedidos de teste e seus vínculos, e clientes de teste.
    # Ordem importa: itens/movimentos -> pedidos -> clientes (FK customer_id nos pedidos).
    order_ids = "','".join(CREATED_ORDER_IDS)
    sql = []
    if CREATED_ORDER_IDS:
        sql.append(f"DELETE FROM order_items WHERE order_id IN ('{order_ids}');")
        sql.append(f"DELETE FROM stock_movements WHERE order_id IN ('{order_ids}');")
        sql.append(f"DELETE FROM orders WHERE id IN ('{order_ids}');")
    sql.append(f"DELETE FROM users WHERE email LIKE '%{TEST_EMAIL_TAG}%';")
    # Clientes de teste (por e-mail marcado ou por id criado)
    sql.append(f"DELETE FROM customers WHERE email LIKE '%{TEST_EMAIL_TAG}%';")
    if CREATED_CUSTOMER_IDS:
        cust_ids = "','".join(CREATED_CUSTOMER_IDS)
        sql.append(f"DELETE FROM customers WHERE id IN ('{cust_ids}');")
    # Produtos de teste criados pela suíte (sob encomenda / normal): remove vínculos e o produto.
    if CREATED_PRODUCT_IDS:
        prod_ids = "','".join(CREATED_PRODUCT_IDS)
        sql.append(f"DELETE FROM product_images WHERE product_id IN ('{prod_ids}');")
        sql.append(f"DELETE FROM stock_movements WHERE product_id IN ('{prod_ids}');")
        sql.append(f"DELETE FROM order_items WHERE product_id IN ('{prod_ids}');")
        sql.append(f"DELETE FROM products WHERE id IN ('{prod_ids}');")
    r = subprocess.run(["psql", "-d", DB, "-c", " ".join(sql)], capture_output=True, text=True)
    print(f"  psql cleanup rc={r.returncode} {r.stdout.strip()} {r.stderr.strip()}")

    # Verificações de não-vazamento
    st, users = request("GET", "/api/admin/users")
    leaked_u = [u for u in users if TEST_EMAIL_TAG in u.get("email", "")] if isinstance(users, list) else ["?"]
    R.check("CLEANUP.sem_usuarios_teste", len(leaked_u) == 0, 0, len(leaked_u))

    st, promos = request("GET", "/api/admin/promotions")
    leaked_p = [p for p in promos if p.get("id") in CREATED_PROMO_IDS] if isinstance(promos, list) else ["?"]
    R.check("CLEANUP.sem_promos_teste", len(leaked_p) == 0, 0, len(leaked_p))

    st, custs = request("GET", "/api/admin/customers")
    leaked_c = [c for c in custs if TEST_EMAIL_TAG in (c.get("email") or "")] if isinstance(custs, list) else ["?"]
    R.check("CLEANUP.sem_clientes_teste", len(leaked_c) == 0, 0, len(leaked_c))

    leaked_prod = subprocess.run(["psql", "-d", DB, "-tAc",
                                  "SELECT count(*) FROM products WHERE sku LIKE 'QA-OD-%' OR sku LIKE 'QA-NORM-%';"],
                                 capture_output=True, text=True)
    R.check("CLEANUP.sem_produtos_teste", leaked_prod.stdout.strip() == "0", "0", leaked_prod.stdout.strip())


def main():
    t0 = time.time()
    login_main()
    print("Login admin homolog OK. Iniciando bateria da LEVA...\n")
    try:
        suite_usuarios()
        suite_templates()
        suite_pedidos_telefone()
        suite_catalogo_promo()
        suite_clientes()
        suite_sob_encomenda()
        suite_stock_dashboard()
        suite_promotions_dashboard()
        suite_period_filter()
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
