#!/usr/bin/env python3
"""
Bateria de SEGURANÇA — valida as correções dos achados de red team.

Cobre com muitas variações: vazamento de custo (catálogo + pedido público),
SSRF (dezenas de URLs maliciosas), upload por magic bytes (tipos falsos e reais),
RBAC de consignados, autenticação por cookie/header, e rate limiting de login.

Parametrizável por env: QA_BASE, QA_ADMIN_EMAIL, QA_ADMIN_PASS.
Sem dependências externas (stdlib). Limpa recursos criados ao final.
"""

import json
import os
import sys
import time
import io
import urllib.request
import urllib.error
import urllib.parse
import http.cookiejar

BASE = os.environ.get("QA_BASE", "http://localhost:8081")
ADMIN_EMAIL = os.environ.get("QA_ADMIN_EMAIL", "admin@homolog.com")
ADMIN_PASS = os.environ.get("QA_ADMIN_PASS", "homolog123")


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

_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))


def request(method, path, token=None, body=None, headers=None, no_cookie=False):
    url = BASE + path
    data = None
    hdrs = headers or {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    if token:
        hdrs["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    opener = urllib.request.urlopen if no_cookie else _opener.open
    try:
        with opener(req, timeout=30) as resp:
            text = resp.read().decode("utf-8")
            return resp.getcode(), (json.loads(text) if text and text.strip().startswith(("{", "[")) else text)
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        try:
            return e.code, json.loads(text)
        except Exception:
            return e.code, text
    except Exception as e:
        return 0, str(e)


def multipart_upload(path, filename, content_bytes, declared_type, token=None):
    """Monta um corpo multipart/form-data manualmente para testar upload."""
    boundary = "----qaboundary" + str(int(time.time() * 1000))
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode())
    body.write(f"Content-Type: {declared_type}\r\n\r\n".encode())
    body.write(content_bytes)
    body.write(f"\r\n--{boundary}--\r\n".encode())
    data = body.getvalue()
    hdrs = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if token:
        hdrs["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=data, method="POST", headers=hdrs)
    try:
        with _opener.open(req, timeout=30) as resp:
            return resp.getcode(), resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)


def login():
    st, b = request("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if st == 200 and isinstance(b, dict) and b.get("id"):
        c = next((ck.value for ck in _jar if ck.name == "jwt"), None)
        return c
    print(f"FATAL: login falhou (status={st}, body={b})")
    sys.exit(1)


def create_product(**ov):
    n = int(time.time() * 1000000) % 1000000000
    payload = {"sku": f"SEC-{n}", "name": "Produto Seguranca QA", "category": "Anel",
               "costPrice": 18.6, "salePrice": 124.0, "stockQuantity": 5}
    payload.update(ov)
    st, b = request("POST", "/api/admin/products", token=TOKEN, body=payload)
    if st == 201 and isinstance(b, dict) and b.get("id"):
        CREATED_PRODUCTS.add(b["id"])
    return st, b


TOKEN = login()
print("Login OK. Iniciando bateria de segurança...\n")


# ===========================================================================
# S1 — Vazamento de custo/estoque no catálogo público
# ===========================================================================
def s1_vazamento_catalogo():
    print("== S1: Vazamento no catálogo público ==")
    # cria um produto com custo/estoque/fornecedor conhecidos
    create_product(name="Vazamento Teste", costPrice=18.6, supplierPrice=30.0,
                   stockQuantity=7, lowStockThreshold=3, purchaseDate="2026-08-01", warrantyMonths=12)

    sensiveis = ["costPrice", "supplierPrice", "stockQuantity", "lowStockThreshold",
                 "supplierId", "supplierName", "purchaseDate", "warrantyMonths",
                 "warrantyExpiresAt", "createdAt", "updatedAt", "status"]
    publicos_ok = ["id", "sku", "name", "salePrice", "stockStatus", "category"]

    for endpoint in ["/api/products/catalog", "/api/products",
                     "/api/products?search=Vazamento", "/api/products?category=Anel",
                     "/api/products?stockStatus=DISPONIVEL"]:
        st, d = request("GET", endpoint, no_cookie=True)
        R.check(f"S1.{endpoint}.200", st == 200, 200, st)
        if isinstance(d, list) and d:
            for campo in sensiveis:
                vaza = any(campo in p for p in d)
                R.check(f"S1.{endpoint}.sem[{campo}]", not vaza, f"{campo} ausente", "VAZOU" if vaza else "ok")
            for campo in publicos_ok:
                tem = all(campo in p for p in d)
                R.check(f"S1.{endpoint}.tem[{campo}]", tem, f"{campo} presente", "faltou" if not tem else "ok")


# ===========================================================================
# S2 — Vazamento de custo no pedido público
# ===========================================================================
def s2_vazamento_pedido():
    print("== S2: Vazamento no pedido público ==")
    st, p = create_product(name="Pedido Vazamento", costPrice=50.0, salePrice=200.0, stockQuantity=10)
    pid = p.get("id") if isinstance(p, dict) else None
    if not pid:
        R.check("S2.setup", False, "produto criado", None)
        return
    # pedido público (sem auth)
    for i in range(5):
        st, o = request("POST", "/api/orders", body={"productIds": [pid]}, no_cookie=True)
        R.check(f"S2.pedido[{i}].201", st == 201, 201, st)
        if isinstance(o, dict):
            items = o.get("items", [])
            for it in items:
                R.check(f"S2.pedido[{i}].sem_costPrice", it.get("costPrice") is None,
                        "costPrice=None", it.get("costPrice"))
                # preço de venda deve continuar presente (cliente precisa)
                R.check(f"S2.pedido[{i}].tem_preco", it.get("unitPrice") is not None or it.get("effectivePrice") is not None,
                        "preço presente", None)


# ===========================================================================
# S3 — SSRF no import CSV (dezenas de URLs maliciosas)
# ===========================================================================
def s3_ssrf():
    print("== S3: SSRF no import CSV ==")
    # URLs que DEVEM ser rejeitadas
    maliciosas = [
        "http://127.0.0.1:8080/actuator/docs.google.com/spreadsheets",
        "http://169.254.169.254/latest/meta-data/#docs.google.com/spreadsheets",
        "http://localhost/docs.google.com/spreadsheets",
        "http://evil.com/docs.google.com/spreadsheets",
        "https://evil.com/spreadsheets/d/x/pub?output=csv",
        "https://169.254.169.254/spreadsheets/foo",
        "https://docs.google.com.evil.com/spreadsheets/x",
        "https://evil.docs.google.com/spreadsheets/x",
        "http://docs.google.com/spreadsheets/x",   # http (não https)
        "ftp://docs.google.com/spreadsheets/x",
        "https://metadata.google.internal/spreadsheets/x",
        "https://10.0.0.1/spreadsheets/x",
        "https://192.168.0.1/spreadsheets/x",
        "https://[::1]/spreadsheets/x",
        "https://docs.google.com@evil.com/spreadsheets/x",
        "https://evil.com/#docs.google.com/spreadsheets",
        "https://evil.com/?x=docs.google.com/spreadsheets",
        "file:///etc/passwd",
        "gopher://127.0.0.1:8080/",
        "https://docs.google.com/other/path",       # host ok, path errado
        "https://docs.google.com",                    # sem path de spreadsheet
        "",
        "not-a-url",
        "javascript:alert(1)",
    ]
    for u in maliciosas:
        st, b = request("POST", "/api/admin/products/import", token=TOKEN, body={"url": u})
        # deve rejeitar com 400 e NÃO fazer a requisição (sem 200)
        R.check(f"S3.rejeita[{u[:45]}]", st == 400, 400, st)
        # a mensagem não deve vazar detalhe de host interno
        if isinstance(b, dict):
            msg = str(b.get("error", "")).lower()
            leak = any(x in msg for x in ["connection refused", "no route", "timed out", "http 403", "http 500"])
            R.check(f"S3.sem_leak[{u[:30]}]", not leak, "sem detalhe interno", msg[:40])


# ===========================================================================
# S4 — Upload por magic bytes (tipos falsos e reais)
# ===========================================================================
def s4_upload():
    print("== S4: Upload por magic bytes ==")
    # Conteúdos maliciosos/falsos que DEVEM ser rejeitados, mesmo com Content-Type de imagem
    png_magic = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    jpeg_magic = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 20
    webp_magic = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 20

    falsos = [
        ("evil.html", b"<html><script>alert(1)</script></html>", "image/png"),
        ("evil.svg", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "image/png"),
        ("evil.php", b"<?php system($_GET['c']); ?>", "image/jpeg"),
        ("evil.js", b"alert(document.cookie)", "image/webp"),
        ("empty.png", b"", "image/png"),
        ("text.png", b"just plain text not an image", "image/png"),
        ("pdf.png", b"%PDF-1.4 fake pdf", "image/png"),
        ("gif.png", b"GIF89a" + b"\x00" * 20, "image/png"),  # GIF não está na whitelist
        ("html-bom.png", b"\xef\xbb\xbf<html></html>", "image/png"),
        ("partial-png.png", b"\x89PN", "image/png"),  # header incompleto
    ]
    for fname, content, ctype in falsos:
        st, b = multipart_upload("/api/admin/products/upload", fname, content, ctype, token=TOKEN)
        R.check(f"S4.rejeita_falso[{fname}]", st == 400, 400, st)

    # Imagens REAIS (magic bytes válidos) DEVEM ser aceitas
    reais = [("real.png", png_magic, "image/png"),
             ("real.jpg", jpeg_magic, "image/jpeg"),
             ("real.webp", webp_magic, "image/webp"),
             # extensão errada mas conteúdo real de imagem: aceita e normaliza extensão
             ("wrongext.txt", png_magic, "image/png")]
    uploaded = []
    for fname, content, ctype in reais:
        st, b = multipart_upload("/api/admin/products/upload", fname, content, ctype, token=TOKEN)
        R.check(f"S4.aceita_real[{fname}]", st == 200, 200, st)
        try:
            url = json.loads(b).get("url", "")
            uploaded.append(url)
            # o arquivo salvo deve ter extensão segura derivada do tipo real
            R.check(f"S4.ext_segura[{fname}]", url.endswith((".png", ".jpg", ".webp")),
                    "extensão de imagem", url[-6:])
        except Exception:
            R.check(f"S4.url_valida[{fname}]", False, "url json", b[:40])

    # Upload sem auth deve ser negado
    st, b = multipart_upload("/api/admin/products/upload", "x.png", png_magic, "image/png", token=None)
    # com cookie do jar ainda autentica; então testa sem cookie
    st2, b2 = _upload_no_auth(png_magic)
    R.check("S4.upload_sem_auth.nega", st2 in (401, 403), "401/403", st2)


def _upload_no_auth(content):
    boundary = "----na" + str(int(time.time() * 1000))
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="x.png"\r\n')
    body.write(b"Content-Type: image/png\r\n\r\n")
    body.write(content)
    body.write(f"\r\n--{boundary}--\r\n".encode())
    req = urllib.request.Request(BASE + "/api/admin/products/upload", data=body.getvalue(),
                                 method="POST", headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:  # sem cookie jar
            return resp.getcode(), resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)


# ===========================================================================
# S5 — RBAC de consignados (agora exige ADMIN)
# ===========================================================================
def s5_rbac_consignados():
    print("== S5: RBAC consignados ==")
    rotas = [
        ("GET", "/api/consignees"),
        ("GET", "/api/consignees/00000000-0000-0000-0000-000000000000"),
        ("POST", "/api/consignees"),
        ("PUT", "/api/consignees/00000000-0000-0000-0000-000000000000"),
        ("DELETE", "/api/consignees/00000000-0000-0000-0000-000000000000"),
    ]
    # sem token e com token inválido => nega
    for method, path in rotas:
        st, _ = request(method, path, no_cookie=True)
        R.check(f"S5.sem_token.{method} {path}", st in (401, 403), "401/403", st)
        st2, _ = request(method, path, token="lixo.invalido", no_cookie=True)
        R.check(f"S5.token_invalido.{method} {path}", st2 in (401, 403), "401/403", st2)
    # admin acessa a listagem
    st, _ = request("GET", "/api/consignees", token=TOKEN)
    R.check("S5.admin.GET consignees.200", st == 200, 200, st)


# ===========================================================================
# S6 — Autenticação: cookie/header, /me, logout
# ===========================================================================
def s6_auth():
    print("== S6: Autenticação cookie/header ==")
    # login limpo num jar separado para inspecionar cookie
    jar2 = http.cookiejar.CookieJar()
    op2 = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar2))

    def req2(method, path, body=None, token=None):
        data = json.dumps(body).encode() if body is not None else None
        hdrs = {"Content-Type": "application/json"} if body is not None else {}
        if token:
            hdrs["Authorization"] = "Bearer " + token
        r = urllib.request.Request(BASE + path, data=data, method=method, headers=hdrs)
        try:
            with op2.open(r, timeout=30) as resp:
                t = resp.read().decode()
                return resp.getcode(), (json.loads(t) if t and t.strip().startswith("{") else t)
        except urllib.error.HTTPError as e:
            return e.code, None

    st, b = req2("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    R.check("S6.login.200", st == 200, 200, st)
    R.check("S6.login.body_sem_token", isinstance(b, dict) and not b.get("token"), "sem token no body", b.get("token") if isinstance(b, dict) else b)
    jwt_cookie = next((c for c in jar2 if c.name == "jwt"), None)
    R.check("S6.cookie.emitido", jwt_cookie is not None, "cookie jwt", None)

    # /me com cookie
    st, b = req2("GET", "/api/auth/me")
    R.check("S6.me.com_cookie.200", st == 200, 200, st)

    # /me sem cookie (jar limpo)
    st, _ = request("GET", "/api/auth/me", no_cookie=True)
    R.check("S6.me.sem_cookie.401", st == 401, 401, st)

    # header Authorization ainda funciona (retrocompat) — usa TOKEN global
    st, _ = request("GET", "/api/admin/orders", token=TOKEN, no_cookie=True)
    R.check("S6.header.retrocompat.200", st == 200, 200, st)

    # token forjado/inválido no header
    for bad in ["lixo", "a.b.c", "Bearer x", "null", "undefined"]:
        st, _ = request("GET", "/api/admin/orders", token=bad, no_cookie=True)
        R.check(f"S6.token_forjado[{bad}].nega", st in (401, 403), "401/403", st)

    # logout limpa a sessão
    st, _ = req2("POST", "/api/auth/logout")
    R.check("S6.logout.200", st == 200, 200, st)
    st, _ = req2("GET", "/api/auth/me")
    R.check("S6.me.apos_logout.401", st == 401, 401, st)


# ===========================================================================
# S7 — Rate limiting de login
# ===========================================================================
def s8_ssrf_ampla():
    """Varredura ampla adicional de SSRF: combinações de esquema, host, porta,
    IP privado, encoding e truques de bypass — todas devem ser rejeitadas (400)."""
    print("== S8: SSRF varredura ampla ==")
    schemes = ["http", "https", "ftp", "file", "gopher", "dict", "ldap"]
    internal_hosts = ["127.0.0.1", "localhost", "0.0.0.0", "169.254.169.254",
                      "10.0.0.1", "192.168.1.1", "172.16.0.1", "metadata.google.internal",
                      "[::1]", "127.0.0.1:8080", "backend:8080"]
    # esquema x host interno (com path que contém a substring antiga)
    for sc in schemes:
        for h in internal_hosts:
            u = f"{sc}://{h}/docs.google.com/spreadsheets/d/x"
            st, _ = request("POST", "/api/admin/products/import", token=TOKEN, body={"url": u})
            R.check(f"S8.{sc}://{h}.rejeita", st == 400, 400, st)
    # truques de bypass com host confiável na posição errada
    bypass = [
        "https://docs.google.com.attacker.com/spreadsheets/x",
        "https://attacker.com/docs.google.com/spreadsheets/x",
        "https://docs.google.com@attacker.com/spreadsheets/x",
        "https://attacker.com#docs.google.com/spreadsheets/x",
        "https://attacker.com?docs.google.com/spreadsheets/x",
        "https://attacker.com/spreadsheets/docs.google.com",
        "https://DOCS.GOOGLE.COM.evil.com/spreadsheets/x",
        "https://docs%2Egoogle%2Ecom/spreadsheets/x",
        "https://docs.google.com../spreadsheets/x",
    ]
    for u in bypass:
        st, _ = request("POST", "/api/admin/products/import", token=TOKEN, body={"url": u})
        R.check(f"S8.bypass[{u[:40]}].rejeita", st == 400, 400, st)


def s9_headers_e_metodos():
    """Verifica métodos HTTP não suportados e comportamento de rotas admin sob
    diferentes métodos — não devem expor nem dar 500."""
    print("== S9: Métodos e rotas ==")
    # métodos não permitidos em endpoints existentes → 4xx (não 5xx)
    casos = [
        ("PUT", "/api/products/catalog"),
        ("DELETE", "/api/products"),
        ("PATCH", "/api/auth/me"),
        ("PUT", "/api/orders"),
        ("GET", "/api/auth/login"),
    ]
    for method, path in casos:
        st, _ = request(method, path, no_cookie=True)
        R.check(f"S9.metodo[{method} {path}].4xx", 400 <= st < 500, "4xx", st)
    # rota inexistente → 404 (ou 401/403 se cair no filtro)
    for path in ["/api/naoexiste", "/api/admin/naoexiste", "/api/products/../../etc"]:
        st, _ = request("GET", path, no_cookie=True)
        R.check(f"S9.rota_inexistente[{path[:20]}].nao_5xx", st < 500, "<500", st)


def s10_validacao_produto_admin():
    """Varredura de validação de produto no endpoint admin (autenticado)."""
    print("== S10: Validação de produto (admin) ==")
    # nomes em vários tamanhos
    for length, expected in [(1, 400), (2, 400), (3, 201), (50, 201), (120, 201), (121, 400)]:
        st, b = create_product(name="X" * length)
        R.check(f"S10.nome[{length}].{expected}", st == expected, expected, st)
    # preços inválidos
    for campo, val in [("costPrice", 0), ("costPrice", -1), ("salePrice", 0), ("salePrice", -5),
                       ("supplierPrice", -1), ("stockQuantity", -1), ("warrantyMonths", -1)]:
        st, b = create_product(name="Val invalido", **{campo: val})
        R.check(f"S10.invalido[{campo}={val}].400", st == 400, 400, st)
    # SKU duplicado
    st, p = create_product(name="Dono SKU")
    if isinstance(p, dict) and p.get("sku"):
        st2, _ = request("POST", "/api/admin/products", token=TOKEN, body={
            "sku": p["sku"], "name": "Duplicado", "category": "Anel", "costPrice": 5.0, "salePrice": 10.0})
        R.check("S10.sku_duplicado.400", st2 == 400, 400, st2)


def s7_rate_limit():
    print("== S7: Rate limiting de login ==")
    # dispara 25 logins com senha errada de um jar isolado (sem cookie) — deve
    # bater 429 após 20. Usa no_cookie para não misturar com a sessão principal.
    got_429 = False
    codes = []
    for i in range(25):
        st, _ = request("POST", "/api/auth/login",
                        body={"email": "naoexiste@x.com", "password": f"errada{i}"}, no_cookie=True)
        codes.append(st)
        if st == 429:
            got_429 = True
    R.check("S7.rate_limit.dispara_429", got_429, "429 após limite", codes[-5:])
    # antes do limite deve haver 401 (credencial inválida)
    R.check("S7.rate_limit.401_antes", 401 in codes[:5], "401 no início", codes[:5])


def cleanup():
    print("\n== CLEANUP ==")
    deleted = 0
    for pid in list(CREATED_PRODUCTS):
        st, _ = request("DELETE", f"/api/admin/products/{pid}", token=TOKEN)
        if st == 200:
            deleted += 1
    print(f"  produtos removidos: {deleted} de {len(CREATED_PRODUCTS)}")


def main():
    t0 = time.time()
    try:
        s1_vazamento_catalogo()
        s2_vazamento_pedido()
        s3_ssrf()
        s4_upload()
        s5_rbac_consignados()
        s6_auth()
        s8_ssrf_ampla()
        s9_headers_e_metodos()
        s10_validacao_produto_admin()
        s7_rate_limit()
    finally:
        cleanup()
    dt = time.time() - t0
    total = R.passed + R.failed
    print("\n" + "=" * 60)
    print(f"SEGURANÇA — TOTAL: {total} | PASS: {R.passed} | FAIL: {R.failed} | {dt:.1f}s")
    print("=" * 60)
    if R.failures:
        for name, exp, got in R.failures:
            print(f"  - {name}: esperado={exp} obtido={got}")
    sys.exit(0 if R.failed == 0 else 1)


if __name__ == "__main__":
    main()
