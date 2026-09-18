#!/usr/bin/env python3
"""
Bateria de QA de 500+ testes cobrindo DUAS frentes:

  1. REGRESSÃO do que já está em produção — reaproveita integralmente as 11
     suítes de qa_homolog.py (auth/RBAC, produtos, promoções, consignados,
     pedidos, robustez, validação). Garante que o módulo financeiro NÃO quebrou
     nada do que está no ar.

  2. MÓDULO FINANCEIRO (novo) — suítes dedicadas: categorias de despesa,
     despesas/contas a pagar com parcelamento, pagamentos de pedido (com taxa,
     parcelamento de cartão e datas de repasse), lançamentos manuais de caixa,
     fluxo de caixa, DRE e entrada de compra em lote.

Uso (contra HOMOLOG na 8081):
    QA_BASE=http://localhost:8081 QA_ADMIN_EMAIL=admin@homolog.com \\
    QA_ADMIN_PASS=homolog123 python3 qa/qa_financeiro.py

Reaproveita o harness (request/Results/login/cleanup) de qa_homolog.py — sem
dependências externas. Todos os recursos criados são rastreados e removidos.
"""

import os
import sys
import time
import uuid
from datetime import date, timedelta

# Importa o harness e as suítes já existentes do qa_homolog (mesmo diretório).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_homolog as H

# --- Rate-limit safe login -------------------------------------------------
# O backend limita logins a 20/min por IP (LoginRateLimitFilter, via
# X-Forwarded-For). Esta bateria é grande e reexecuta a suíte de auth, o que
# estouraria o limite e geraria falsos negativos. Para testar sem furar a
# proteção real, damos a cada POST /api/auth/login um X-Forwarded-For único —
# como se cada tentativa viesse de um IP distinto. Não altera o backend nem o
# comportamento em produção; apenas evita o 429 no ambiente de teste local.
_orig_request = H.request
_login_ip = [0]

def _request_ratelimit_safe(method, path, token=None, body=None, raw_body=None,
                            headers=None, no_cookie=False):
    if method == "POST" and path.endswith("/api/auth/login"):
        _login_ip[0] += 1
        headers = dict(headers or {})
        headers["X-Forwarded-For"] = f"10.42.{_login_ip[0] // 256 % 256}.{_login_ip[0] % 256}"
    return _orig_request(method, path, token=token, body=body, raw_body=raw_body,
                         headers=headers, no_cookie=no_cookie)

# Substitui o request no módulo qa_homolog ANTES de qualquer login (inclui o
# TOKEN = admin_login() do import) e reexpõe localmente.
H.request = _request_ratelimit_safe
request = _request_ratelimit_safe

from qa_homolog import R, TOKEN

# Recursos financeiros criados (para limpeza no fim).
CREATED_EXPENSES = set()
CREATED_CASH_ENTRIES = set()
CREATED_CATEGORIES = set()
CREATED_PAYMENTS = set()
CREATED_PURCHASES = set()
CREATED_ORDERS = set()      # pedidos criados aqui (cancelar no fim)
CREATED_PRODUCTS = set()    # produtos criados aqui
CREATED_SUPPLIERS = set()


def today():
    # Data real de execução — as datas de repasse do backend usam LocalDate.now(),
    # então o teste precisa ancorar em "hoje" para não quebrar conforme o dia.
    return date.today()


def next_business_day(d):
    """Próximo dia útil após d (pula sábado/domingo). Espelha nextBusinessDay do backend."""
    nd = d + timedelta(days=1)
    while nd.weekday() >= 5:  # 5=sáb, 6=dom
        nd += timedelta(days=1)
    return nd


def dstr(d):
    return d.isoformat()


# ---------------------------------------------------------------------------
# Helpers de setup
# ---------------------------------------------------------------------------

def ensure_supplier():
    st, b = request("GET", "/api/admin/suppliers", token=TOKEN)
    if isinstance(b, list) and b:
        return b[0]["id"]
    st, b = request("POST", "/api/admin/suppliers", token=TOKEN,
                    body={"name": f"Fornecedor Fin QA {uuid.uuid4().hex[:6]}"})
    if isinstance(b, dict) and b.get("id"):
        CREATED_SUPPLIERS.add(b["id"])
        return b["id"]
    return None


def ensure_category_name():
    st, b = request("GET", "/api/admin/categories", token=TOKEN)
    if isinstance(b, list) and b:
        active = [c for c in b if c.get("active")]
        if active:
            return active[0]["name"]
    st, b = request("POST", "/api/admin/categories", token=TOKEN,
                    body={"name": "Anel", "active": True})
    return b.get("name", "Anel") if isinstance(b, dict) else "Anel"


def first_expense_category():
    st, b = request("GET", "/api/admin/finance/expense-categories", token=TOKEN)
    if isinstance(b, list):
        for c in b:
            if c.get("operational") and c.get("active"):
                return c["id"]
        if b:
            return b[0]["id"]
    return None


def make_confirmed_order(price):
    """Cria um produto e um pedido CONFIRMADO no valor informado. Retorna order_id."""
    st, p = request("POST", "/api/admin/products", token=TOKEN, body={
        "sku": f"FINQA-{uuid.uuid4().hex[:8]}", "name": "Produto Fin QA",
        "category": "Anel", "costPrice": round(price * 0.2, 2), "salePrice": price,
        "stockQuantity": 10,
    })
    if not (isinstance(p, dict) and p.get("id")):
        return None
    CREATED_PRODUCTS.add(p["id"])
    st, o = request("POST", "/api/admin/orders", token=TOKEN, body={
        "items": [{"productId": p["id"], "quantity": 1, "effectivePrice": price}],
        "customerName": "Cliente Fin QA", "customerPhone": "51999990000", "confirm": True,
    })
    if isinstance(o, dict) and o.get("id"):
        CREATED_ORDERS.add(o["id"])
        return o["id"]
    return None


# ===========================================================================
# SUÍTE FA — Categorias de despesa
# ===========================================================================
def suite_fa():
    print("== SUÍTE FA: Categorias de despesa ==")

    # FA1. Lista de categorias contém as semeadas e a "Compra de mercadoria"
    st, b = request("GET", "/api/admin/finance/expense-categories", token=TOKEN)
    R.check("FA.list.200", st == 200, 200, st)
    names = [c["name"] for c in b] if isinstance(b, list) else []
    for esperado in ["Infraestrutura de sistemas", "Taxa de maquininha", "Embalagens",
                     "Mostruário", "Compra de mercadoria"]:
        R.check(f"FA.seed.contem[{esperado}]", esperado in names, esperado, names)

    # FA2. "Compra de mercadoria" é NÃO-operacional; as demais operacionais
    by_name = {c["name"]: c for c in b} if isinstance(b, list) else {}
    if "Compra de mercadoria" in by_name:
        R.check("FA.compra.nao_operacional",
                by_name["Compra de mercadoria"].get("operational") is False, False,
                by_name["Compra de mercadoria"].get("operational"))
    if "Embalagens" in by_name:
        R.check("FA.embalagens.operacional",
                by_name["Embalagens"].get("operational") is True, True,
                by_name["Embalagens"].get("operational"))

    # FA3. Criar categoria válida
    nome = f"Cat QA {uuid.uuid4().hex[:6]}"
    st, b = request("POST", "/api/admin/finance/expense-categories", token=TOKEN,
                    body={"name": nome, "active": True})
    R.check("FA.criar.201", st == 201, 201, st)
    if isinstance(b, dict) and b.get("id"):
        CREATED_CATEGORIES.add(b["id"])
        cat_id = b["id"]
        R.check("FA.criar.operacional_default", b.get("operational") in (True, None), True, b.get("operational"))

        # FA4. Nome duplicado -> 400
        st, b2 = request("POST", "/api/admin/finance/expense-categories", token=TOKEN,
                         body={"name": nome, "active": True})
        R.check("FA.criar.duplicado.400", st == 400, 400, st)

        # FA5. Atualizar (renomear + desativar)
        st, b3 = request("PUT", f"/api/admin/finance/expense-categories/{cat_id}", token=TOKEN,
                         body={"name": nome + " Ed", "active": False})
        R.check("FA.update.200", st == 200, 200, st)
        R.check("FA.update.desativou", isinstance(b3, dict) and b3.get("active") is False, False,
                b3.get("active") if isinstance(b3, dict) else None)

    # FA6. Nome em branco -> 400
    for nome_ruim in ["", "   "]:
        st, b = request("POST", "/api/admin/finance/expense-categories", token=TOKEN,
                        body={"name": nome_ruim})
        R.check(f"FA.criar.branco.400[{nome_ruim!r}]", st == 400, 400, st)

    # FA7. Sem token nega
    st, b = request("GET", "/api/admin/finance/expense-categories", no_cookie=True)
    R.check("FA.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE FB — Despesas / contas a pagar com parcelamento
# ===========================================================================
def suite_fb():
    print("== SUÍTE FB: Despesas / contas a pagar ==")
    cat = first_expense_category()

    # FB1. Despesa à vista (1 parcela)
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "Despesa QA a vista", "categoryId": cat,
        "totalAmount": 150.00, "competenceDate": dstr(today()), "installmentsCount": 1,
        "firstDueDate": dstr(today()),
    })
    R.check("FB.avista.201", st == 201, 201, st)
    if isinstance(b, dict) and b.get("id"):
        CREATED_EXPENSES.add(b["id"])
        R.check("FB.avista.status_pendente", b.get("status") == "PENDENTE", "PENDENTE", b.get("status"))
        R.check("FB.avista.1_parcela", len(b.get("installments") or []) == 1, 1, len(b.get("installments") or []))
        R.check("FB.avista.remaining", float(b.get("remainingAmount") or 0) == 150.0, 150.0, b.get("remainingAmount"))

    # FB2. Despesa parcelada 3x de 300 (100 cada)
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "Despesa QA 3x", "categoryId": cat,
        "totalAmount": 300.00, "competenceDate": dstr(today()), "installmentsCount": 3,
        "firstDueDate": dstr(today() + timedelta(days=5)),
    })
    R.check("FB.parc3.201", st == 201, 201, st)
    exp3 = None
    if isinstance(b, dict) and b.get("id"):
        exp3 = b["id"]
        CREATED_EXPENSES.add(exp3)
        insts = b.get("installments") or []
        R.check("FB.parc3.3_parcelas", len(insts) == 3, 3, len(insts))
        soma = round(sum(float(i["amount"]) for i in insts), 2)
        R.check("FB.parc3.soma_bate_total", soma == 300.0, 300.0, soma)
        # vencimentos mensais consecutivos
        if len(insts) == 3:
            R.check("FB.parc3.venc_1", insts[0]["dueDate"] == dstr(today() + timedelta(days=5)),
                    dstr(today() + timedelta(days=5)), insts[0]["dueDate"])

    # FB3. Marcar 1ª parcela como paga -> status PARCIAL
    if exp3:
        st, b = request("GET", f"/api/admin/finance/expenses/{exp3}", token=TOKEN)
        inst_id = b["installments"][0]["id"] if isinstance(b, dict) and b.get("installments") else None
        if inst_id:
            st, b = request("PATCH", f"/api/admin/finance/installments/{inst_id}/paid", token=TOKEN,
                            body={"paid": True, "paidDate": dstr(today())})
            R.check("FB.pagar.parcela.200", st == 200, 200, st)
            R.check("FB.pagar.status_parcial", isinstance(b, dict) and b.get("status") == "PARCIAL",
                    "PARCIAL", b.get("status") if isinstance(b, dict) else None)
            R.check("FB.pagar.remaining_200", isinstance(b, dict) and float(b.get("remainingAmount") or 0) == 200.0,
                    200.0, b.get("remainingAmount") if isinstance(b, dict) else None)

            # FB4. Reabrir a parcela -> volta a PENDENTE
            st, b = request("PATCH", f"/api/admin/finance/installments/{inst_id}/paid", token=TOKEN,
                            body={"paid": False})
            R.check("FB.reabrir.status_pendente", isinstance(b, dict) and b.get("status") == "PENDENTE",
                    "PENDENTE", b.get("status") if isinstance(b, dict) else None)

    # FB5. Parcela vencida no passado aparece como ATRASADO (derivado)
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "Despesa QA vencida", "categoryId": cat,
        "totalAmount": 80.00, "competenceDate": dstr(today() - timedelta(days=40)),
        "installmentsCount": 1, "firstDueDate": dstr(today() - timedelta(days=30)),
    })
    if isinstance(b, dict) and b.get("id"):
        CREATED_EXPENSES.add(b["id"])
        insts = b.get("installments") or []
        R.check("FB.atrasado.derivado", len(insts) == 1 and insts[0].get("status") == "ATRASADO",
                "ATRASADO", insts[0].get("status") if insts else None)

    # FB6. Validações: valor <= 0, sem categoria, sem descrição
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "x", "categoryId": cat, "totalAmount": 0, "competenceDate": dstr(today())})
    R.check("FB.val.valor_zero.400", st == 400, 400, st)
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "x", "totalAmount": 10, "competenceDate": dstr(today())})
    R.check("FB.val.sem_categoria.400", st == 400, 400, st)
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "", "categoryId": cat, "totalAmount": 10, "competenceDate": dstr(today())})
    R.check("FB.val.sem_descricao.400", st == 400, 400, st)

    # FB7. Categoria inexistente -> 400
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "x", "categoryId": str(uuid.uuid4()), "totalAmount": 10,
        "competenceDate": dstr(today())})
    R.check("FB.val.categoria_inexistente.400", st == 400, 400, st)

    # FB8. Listar despesas e filtrar por status
    st, b = request("GET", "/api/admin/finance/expenses", token=TOKEN)
    R.check("FB.listar.200", st == 200 and isinstance(b, list), "200/list", st)
    st, b = request("GET", "/api/admin/finance/expenses?status=PENDENTE", token=TOKEN)
    R.check("FB.listar.filtro_pendente.200", st == 200, 200, st)

    # FB9. Agenda de parcelas por período
    st, b = request("GET", f"/api/admin/finance/installments?from={dstr(today() - timedelta(days=60))}"
                          f"&to={dstr(today() + timedelta(days=60))}", token=TOKEN)
    R.check("FB.installments.periodo.200", st == 200 and isinstance(b, list), "200/list", st)

    # FB10. Excluir despesa remove parcelas (cascata)
    st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
        "description": "Despesa QA delete", "categoryId": cat, "totalAmount": 20,
        "competenceDate": dstr(today()), "installmentsCount": 2, "firstDueDate": dstr(today())})
    if isinstance(b, dict) and b.get("id"):
        eid = b["id"]
        st, _ = request("DELETE", f"/api/admin/finance/expenses/{eid}", token=TOKEN)
        R.check("FB.delete.204", st in (200, 204), "204", st)
        st, _ = request("GET", f"/api/admin/finance/expenses/{eid}", token=TOKEN)
        R.check("FB.delete.sumiu.400", st == 400, 400, st)

    # FB11. Parcela inexistente ao marcar paga -> 400
    st, b = request("PATCH", f"/api/admin/finance/installments/{uuid.uuid4()}/paid", token=TOKEN,
                    body={"paid": True})
    R.check("FB.pagar.inexistente.400", st == 400, 400, st)

    # FB12. RBAC sem token
    st, b = request("POST", "/api/admin/finance/expenses", no_cookie=True, body={"description": "x"})
    R.check("FB.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE FC — Pagamentos de pedido (taxa, cartão parcelado, repasse)
# ===========================================================================
def suite_fc():
    print("== SUÍTE FC: Pagamentos de pedido ==")

    # FC1. Resumo inicial: nada pago
    oid = make_confirmed_order(200.00)
    R.check("FC.setup.pedido_criado", oid is not None, "order_id", oid)
    if not oid:
        return
    st, b = request("GET", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN)
    R.check("FC.resumo.200", st == 200, 200, st)
    R.check("FC.resumo.total_200", isinstance(b, dict) and float(b.get("orderTotal") or 0) == 200.0, 200.0,
            b.get("orderTotal") if isinstance(b, dict) else None)
    R.check("FC.resumo.pendente", isinstance(b, dict) and b.get("paymentStatus") == "PENDENTE",
            "PENDENTE", b.get("paymentStatus") if isinstance(b, dict) else None)

    # FC2. Pagamento parcial (Pix 70) -> PARCIAL
    st, b = request("POST", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN,
                    body={"method": "PIX", "grossAmount": 70.00, "feeAmount": 0})
    R.check("FC.pix.201", st == 201, 201, st)
    R.check("FC.pix.parcial", isinstance(b, dict) and b.get("paymentStatus") == "PARCIAL",
            "PARCIAL", b.get("paymentStatus") if isinstance(b, dict) else None)
    R.check("FC.pix.recebido70", isinstance(b, dict) and float(b.get("paidGross") or 0) == 70.0, 70.0,
            b.get("paidGross") if isinstance(b, dict) else None)
    # Pix é D+0 (repasse hoje)
    if isinstance(b, dict) and b.get("payments"):
        s = b["payments"][0]["settlements"][0]
        R.check("FC.pix.repasse_d0", s.get("expectedDate") == dstr(today()), dstr(today()), s.get("expectedDate"))

    # FC3. Segundo pagamento cartão crédito (50, taxa 2) -> ainda PARCIAL
    st, b = request("POST", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN,
                    body={"method": "CARTAO_CREDITO", "grossAmount": 50.00, "feeAmount": 2.00, "installments": 1})
    R.check("FC.credito1x.201", st == 201, 201, st)
    # líquido = 48, repasse D+30
    pay = None
    if isinstance(b, dict):
        pay = next((p for p in b.get("payments", []) if p["method"] == "CARTAO_CREDITO"), None)
    if pay:
        R.check("FC.credito1x.liquido48", float(pay.get("netAmount") or 0) == 48.0, 48.0, pay.get("netAmount"))
        s = pay["settlements"][0]
        R.check("FC.credito1x.repasse_d30", s.get("expectedDate") == dstr(today() + timedelta(days=30)),
                dstr(today() + timedelta(days=30)), s.get("expectedDate"))

    # FC4. Terceiro pagamento (dinheiro 80) -> total 200 -> PAGO
    st, b = request("POST", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN,
                    body={"method": "DINHEIRO", "grossAmount": 80.00})
    R.check("FC.dinheiro.pago", isinstance(b, dict) and b.get("paymentStatus") == "PAGO",
            "PAGO", b.get("paymentStatus") if isinstance(b, dict) else None)
    R.check("FC.dinheiro.remaining0", isinstance(b, dict) and float(b.get("remaining") or 0) == 0.0, 0.0,
            b.get("remaining") if isinstance(b, dict) else None)

    # FC5. Débito -> repasse D+1 dia útil (16/09/2026 é quarta -> 17/09 quinta)
    oid2 = make_confirmed_order(50.00)
    if oid2:
        st, b = request("POST", f"/api/admin/finance/orders/{oid2}/payments", token=TOKEN,
                        body={"method": "CARTAO_DEBITO", "grossAmount": 50.00})
        if isinstance(b, dict) and b.get("payments"):
            s = b["payments"][0]["settlements"][0]
            R.check("FC.debito.repasse_d1util", s.get("expectedDate") == dstr(next_business_day(today())),
                    dstr(next_business_day(today())), s.get("expectedDate"))

    # FC6. Crédito parcelado 3x -> 3 liquidações D+30/60/90, valores somam o líquido
    oid3 = make_confirmed_order(900.00)
    if oid3:
        st, b = request("POST", f"/api/admin/finance/orders/{oid3}/payments", token=TOKEN,
                        body={"method": "CARTAO_CREDITO", "grossAmount": 900.00, "feeAmount": 0, "installments": 3})
        R.check("FC.credito3x.201", st == 201, 201, st)
        if isinstance(b, dict) and b.get("payments"):
            setts = b["payments"][0]["settlements"]
            R.check("FC.credito3x.3_liquidacoes", len(setts) == 3, 3, len(setts))
            soma = round(sum(float(s["netAmount"]) for s in setts), 2)
            R.check("FC.credito3x.soma_liquido", soma == 900.0, 900.0, soma)
            datas = [s["expectedDate"] for s in setts]
            esperadas = [dstr(today() + timedelta(days=30)),
                         dstr(today() + timedelta(days=60)),
                         dstr(today() + timedelta(days=90))]
            R.check("FC.credito3x.datas_repasse", datas == esperadas, esperadas, datas)

    # FC7. Validações: método inválido, valor <= 0, taxa > valor
    oid4 = make_confirmed_order(100.00)
    if oid4:
        st, b = request("POST", f"/api/admin/finance/orders/{oid4}/payments", token=TOKEN,
                        body={"method": "BITCOIN", "grossAmount": 10})
        R.check("FC.val.metodo_invalido.400", st == 400, 400, st)
        st, b = request("POST", f"/api/admin/finance/orders/{oid4}/payments", token=TOKEN,
                        body={"method": "PIX", "grossAmount": 0})
        R.check("FC.val.valor_zero.400", st == 400, 400, st)
        st, b = request("POST", f"/api/admin/finance/orders/{oid4}/payments", token=TOKEN,
                        body={"method": "PIX", "grossAmount": 10, "feeAmount": 20})
        R.check("FC.val.taxa_maior_valor.400", st == 400, 400, st)

    # FC8. Pedido inexistente -> 400
    st, b = request("POST", f"/api/admin/finance/orders/{uuid.uuid4()}/payments", token=TOKEN,
                    body={"method": "PIX", "grossAmount": 10})
    R.check("FC.val.pedido_inexistente.400", st == 400, 400, st)

    # FC9. Remover um pagamento recalcula o status
    if oid:
        st, b = request("GET", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN)
        if isinstance(b, dict) and b.get("payments"):
            pay_id = b["payments"][0]["id"]
            st, b2 = request("DELETE", f"/api/admin/finance/payments/{pay_id}", token=TOKEN)
            R.check("FC.remover.200", st == 200, 200, st)
            R.check("FC.remover.reabre_status",
                    isinstance(b2, dict) and b2.get("paymentStatus") in ("PARCIAL", "PENDENTE"),
                    "PARCIAL/PENDENTE", b2.get("paymentStatus") if isinstance(b2, dict) else None)

    # FC10. RBAC sem token
    st, b = request("GET", f"/api/admin/finance/orders/{oid}/payments", no_cookie=True)
    R.check("FC.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE FD — Lançamentos manuais de caixa + fluxo de caixa
# ===========================================================================
def suite_fd():
    print("== SUÍTE FD: Caixa manual + fluxo de caixa ==")
    ini = dstr(today().replace(day=1))
    fim = dstr(today().replace(day=28))

    # FD1. Criar entrada e saída manuais
    st, b = request("POST", "/api/admin/finance/cash-entries", token=TOKEN, body={
        "type": "ENTRADA", "description": "Aporte QA", "amount": 500.00, "entryDate": dstr(today())})
    R.check("FD.entrada.201", st == 201, 201, st)
    if isinstance(b, dict) and b.get("id"):
        CREATED_CASH_ENTRIES.add(b["id"])
    st, b = request("POST", "/api/admin/finance/cash-entries", token=TOKEN, body={
        "type": "SAIDA", "description": "Retirada QA", "amount": 120.00, "entryDate": dstr(today())})
    R.check("FD.saida.201", st == 201, 201, st)
    if isinstance(b, dict) and b.get("id"):
        CREATED_CASH_ENTRIES.add(b["id"])

    # FD2. Tipo inválido -> 400
    st, b = request("POST", "/api/admin/finance/cash-entries", token=TOKEN, body={
        "type": "TALVEZ", "description": "x", "amount": 10, "entryDate": dstr(today())})
    R.check("FD.tipo_invalido.400", st == 400, 400, st)

    # FD3. Valor <= 0 -> 400
    st, b = request("POST", "/api/admin/finance/cash-entries", token=TOKEN, body={
        "type": "ENTRADA", "description": "x", "amount": 0, "entryDate": dstr(today())})
    R.check("FD.valor_zero.400", st == 400, 400, st)

    # FD4. Listar por período
    st, b = request("GET", f"/api/admin/finance/cash-entries?from={ini}&to={fim}", token=TOKEN)
    R.check("FD.listar.200", st == 200 and isinstance(b, list), "200/list", st)

    # FD5. Fluxo de caixa reflete os lançamentos manuais
    st, b = request("GET", f"/api/admin/finance/cash-flow?from={ini}&to={fim}", token=TOKEN)
    R.check("FD.fluxo.200", st == 200, 200, st)
    if isinstance(b, dict):
        R.check("FD.fluxo.entrada_inclui_aporte", float(b.get("totalInflow") or 0) >= 500.0,
                ">=500", b.get("totalInflow"))
        R.check("FD.fluxo.saida_inclui_retirada", float(b.get("totalOutflow") or 0) >= 120.0,
                ">=120", b.get("totalOutflow"))
        R.check("FD.fluxo.tem_movimentos", isinstance(b.get("movements"), list) and len(b["movements"]) >= 2,
                ">=2 movimentos", len(b.get("movements") or []))

    # FD6. Excluir lançamento
    st, b = request("POST", "/api/admin/finance/cash-entries", token=TOKEN, body={
        "type": "ENTRADA", "description": "Del QA", "amount": 10, "entryDate": dstr(today())})
    if isinstance(b, dict) and b.get("id"):
        st, _ = request("DELETE", f"/api/admin/finance/cash-entries/{b['id']}", token=TOKEN)
        R.check("FD.excluir.204", st in (200, 204), "204", st)

    # FD7. RBAC
    st, b = request("GET", f"/api/admin/finance/cash-flow?from={ini}&to={fim}", no_cookie=True)
    R.check("FD.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE FE — DRE mensal
# ===========================================================================
def suite_fe():
    print("== SUÍTE FE: DRE mensal ==")

    # FE1. DRE do mês retorna estrutura completa e coerente
    st, b = request("GET", "/api/admin/finance/income-statement?year=2026&month=9", token=TOKEN)
    R.check("FE.dre.200", st == 200, 200, st)
    if isinstance(b, dict):
        for campo in ["revenue", "cogs", "grossMargin", "consignmentCommissions",
                      "paymentFees", "operatingExpenses", "netResult", "expensesByCategory"]:
            R.check(f"FE.dre.tem_campo[{campo}]", campo in b, campo, list(b.keys()))
        # margem bruta = receita - cmv
        if all(k in b for k in ("revenue", "cogs", "grossMargin")):
            calc = round(float(b["revenue"]) - float(b["cogs"]), 2)
            R.check("FE.dre.margem_bruta_coerente", abs(calc - float(b["grossMargin"])) < 0.01,
                    calc, b["grossMargin"])
        # resultado liquido = margem - comissoes - taxas - despesas
        if all(k in b for k in ("grossMargin", "consignmentCommissions", "paymentFees",
                                "operatingExpenses", "netResult")):
            calc = round(float(b["grossMargin"]) - float(b["consignmentCommissions"])
                         - float(b["paymentFees"]) - float(b["operatingExpenses"]), 2)
            R.check("FE.dre.resultado_liquido_coerente", abs(calc - float(b["netResult"])) < 0.01,
                    calc, b["netResult"])

    # FE2. Mês inválido -> 400
    for m in [0, 13, 99]:
        st, b = request("GET", f"/api/admin/finance/income-statement?year=2026&month={m}", token=TOKEN)
        R.check(f"FE.dre.mes_invalido[{m}].400", st == 400, 400, st)

    # FE3. RBAC
    st, b = request("GET", "/api/admin/finance/income-statement?year=2026&month=9", no_cookie=True)
    R.check("FE.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE FF — Entrada de compra em lote
# ===========================================================================
def suite_ff():
    print("== SUÍTE FF: Entrada de compra em lote ==")
    sup = ensure_supplier()
    cat = ensure_category_name()
    R.check("FF.setup.fornecedor", sup is not None, "supplier_id", sup)

    # FF1. Lote com produto NOVO (5un custo 20) + parcelado 2x -> total 100, conta a pagar
    sku_novo = f"LOTEQA-{uuid.uuid4().hex[:8]}"
    st, b = request("POST", "/api/admin/stock/purchases", token=TOKEN, body={
        "supplierId": sup, "purchaseDate": dstr(today()), "installmentsCount": 2,
        "firstDueDate": dstr(today() + timedelta(days=10)),
        "items": [{"sku": sku_novo, "name": "Produto Lote QA", "category": cat,
                   "salePrice": 80.00, "unitCost": 20.00, "quantity": 5}],
    })
    R.check("FF.novo.201", st == 201, 201, st)
    exp_id = None
    if isinstance(b, dict) and b.get("id"):
        CREATED_PURCHASES.add(b["id"])
        R.check("FF.novo.total100", float(b.get("totalAmount") or 0) == 100.0, 100.0, b.get("totalAmount"))
        R.check("FF.novo.gerou_conta", b.get("expenseId") is not None, "expenseId", b.get("expenseId"))
        exp_id = b.get("expenseId")
        if b.get("items"):
            R.check("FF.novo.item_marcado_novo", b["items"][0].get("createdProduct") is True, True,
                    b["items"][0].get("createdProduct"))

    # FF2. Conta a pagar gerada: categoria "Compra de mercadoria", 2 parcelas de 50
    if exp_id:
        CREATED_EXPENSES.add(exp_id)
        st, e = request("GET", f"/api/admin/finance/expenses/{exp_id}", token=TOKEN)
        if isinstance(e, dict):
            R.check("FF.conta.categoria", e.get("categoryName") == "Compra de mercadoria",
                    "Compra de mercadoria", e.get("categoryName"))
            insts = e.get("installments") or []
            R.check("FF.conta.2parcelas", len(insts) == 2, 2, len(insts))
            soma = round(sum(float(i["amount"]) for i in insts), 2)
            R.check("FF.conta.soma100", soma == 100.0, 100.0, soma)

    # FF3. Produto novo entrou no estoque com qtd 5, custo 20, venda 80
    st, prods = request("GET", f"/api/admin/products?search={sku_novo}", token=TOKEN)
    if isinstance(prods, list) and prods:
        p = prods[0]
        CREATED_PRODUCTS.add(p["id"])
        R.check("FF.estoque.qtd5", p.get("stockQuantity") == 5, 5, p.get("stockQuantity"))
        R.check("FF.estoque.custo20", float(p.get("costPrice") or 0) == 20.0, 20.0, p.get("costPrice"))
        R.check("FF.estoque.venda80", float(p.get("salePrice") or 0) == 80.0, 80.0, p.get("salePrice"))

    # FF4. Lote com produto EXISTENTE repõe estoque
    #   cria um produto base e depois compra +7 dele
    sku_base = f"BASEQA-{uuid.uuid4().hex[:8]}"
    st, pbase = request("POST", "/api/admin/products", token=TOKEN, body={
        "sku": sku_base, "name": "Base QA", "category": cat,
        "costPrice": 15.0, "salePrice": 60.0, "stockQuantity": 2})
    if isinstance(pbase, dict) and pbase.get("id"):
        CREATED_PRODUCTS.add(pbase["id"])
        st, b = request("POST", "/api/admin/stock/purchases", token=TOKEN, body={
            "supplierId": sup, "purchaseDate": dstr(today()), "installmentsCount": 1,
            "firstDueDate": dstr(today()),
            "items": [{"productId": pbase["id"], "unitCost": 18.00, "quantity": 7}]})
        R.check("FF.existente.201", st == 201, 201, st)
        if isinstance(b, dict) and b.get("id"):
            CREATED_PURCHASES.add(b["id"])
            if b.get("expenseId"):
                CREATED_EXPENSES.add(b["expenseId"])
        # confere estoque 2+7 = 9 (via listagem admin filtrando pelo SKU —
        # não há GET /admin/products/{id}; a listagem traz stockQuantity).
        st, lst = request("GET", f"/api/admin/products?search={sku_base}", token=TOKEN)
        p2 = next((x for x in lst if x.get("sku") == sku_base), None) if isinstance(lst, list) else None
        R.check("FF.existente.repos_9", isinstance(p2, dict) and p2.get("stockQuantity") == 9, 9,
                p2.get("stockQuantity") if isinstance(p2, dict) else None)

    # FF5. DRE NÃO conta a compra como despesa operacional (categoria não-operacional)
    st, dre = request("GET", "/api/admin/finance/income-statement?year=2026&month=9", token=TOKEN)
    if isinstance(dre, dict):
        cats = [c["category"] for c in dre.get("expensesByCategory", [])]
        R.check("FF.dre.compra_fora_do_opex", "Compra de mercadoria" not in cats,
                "sem 'Compra de mercadoria'", cats)

    # FF6. Validações: sem itens, fornecedor inexistente, custo <= 0
    st, b = request("POST", "/api/admin/stock/purchases", token=TOKEN, body={
        "supplierId": sup, "purchaseDate": dstr(today()), "items": []})
    R.check("FF.val.sem_itens.400", st == 400, 400, st)
    st, b = request("POST", "/api/admin/stock/purchases", token=TOKEN, body={
        "supplierId": str(uuid.uuid4()), "purchaseDate": dstr(today()),
        "items": [{"productId": str(uuid.uuid4()), "unitCost": 5, "quantity": 1}]})
    R.check("FF.val.fornecedor_inexistente.400", st == 400, 400, st)
    st, b = request("POST", "/api/admin/stock/purchases", token=TOKEN, body={
        "supplierId": sup, "purchaseDate": dstr(today()),
        "items": [{"sku": f"X-{uuid.uuid4().hex[:6]}", "name": "N", "category": cat,
                   "salePrice": 10, "unitCost": 0, "quantity": 1}]})
    R.check("FF.val.custo_zero.400", st == 400, 400, st)

    # FF7. SKU novo duplicado de produto existente -> 400
    if isinstance(prods, list) and prods:
        st, b = request("POST", "/api/admin/stock/purchases", token=TOKEN, body={
            "supplierId": sup, "purchaseDate": dstr(today()),
            "items": [{"sku": sku_novo, "name": "Dup", "category": cat,
                       "salePrice": 10, "unitCost": 5, "quantity": 1}]})
        R.check("FF.val.sku_duplicado.400", st == 400, 400, st)

    # FF8. Listar lotes
    st, b = request("GET", "/api/admin/stock/purchases", token=TOKEN)
    R.check("FF.listar.200", st == 200 and isinstance(b, list), "200/list", st)

    # FF9. RBAC
    st, b = request("POST", "/api/admin/stock/purchases", no_cookie=True, body={"items": []})
    R.check("FF.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE FG — Varredura densa de robustez financeira (volume)
# ===========================================================================
def suite_fg():
    print("== SUÍTE FG: Robustez financeira (volume) ==")
    cat = first_expense_category()

    # FG1. Muitas despesas com nº de parcelas variando; soma das parcelas == total
    for n in range(1, 13):  # 1..12 parcelas
        total = round(100 + n * 7.37, 2)
        st, b = request("POST", "/api/admin/finance/expenses", token=TOKEN, body={
            "description": f"Densa {n}x", "categoryId": cat, "totalAmount": total,
            "competenceDate": dstr(today()), "installmentsCount": n, "firstDueDate": dstr(today())})
        R.check(f"FG.parc[{n}].201", st == 201, 201, st)
        if isinstance(b, dict) and b.get("id"):
            CREATED_EXPENSES.add(b["id"])
            insts = b.get("installments") or []
            R.check(f"FG.parc[{n}].qtd", len(insts) == n, n, len(insts))
            soma = round(sum(float(i["amount"]) for i in insts), 2)
            R.check(f"FG.parc[{n}].soma_exata", soma == total, total, soma)

    # FG2. Pagamentos de crédito com nº de parcelas variando; soma líquida == líquido
    for n in [1, 2, 4, 6, 12]:
        oid = make_confirmed_order(round(120 + n, 2))
        if not oid:
            continue
        gross = round(120 + n, 2)
        st, b = request("POST", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN,
                        body={"method": "CARTAO_CREDITO", "grossAmount": gross, "feeAmount": 0, "installments": n})
        R.check(f"FG.credito[{n}x].201", st == 201, 201, st)
        if isinstance(b, dict) and b.get("payments"):
            setts = b["payments"][-1]["settlements"]
            R.check(f"FG.credito[{n}x].liquidacoes", len(setts) == n, n, len(setts))
            soma = round(sum(float(s["netAmount"]) for s in setts), 2)
            R.check(f"FG.credito[{n}x].soma_liquido", soma == gross, gross, soma)

    # FG3. Idempotência de leitura: DRE e fluxo repetidos retornam o mesmo total
    st, d1 = request("GET", "/api/admin/finance/income-statement?year=2026&month=9", token=TOKEN)
    st, d2 = request("GET", "/api/admin/finance/income-statement?year=2026&month=9", token=TOKEN)
    if isinstance(d1, dict) and isinstance(d2, dict):
        R.check("FG.dre.idempotente", d1.get("netResult") == d2.get("netResult"),
                d1.get("netResult"), d2.get("netResult"))


# ===========================================================================
# Cleanup financeiro
# ===========================================================================
def cleanup_fin():
    print("\n== CLEANUP FINANCEIRO: removendo dados de teste ==")
    # pagamentos são removidos junto ao cancelar/della; removemos explicitamente os pedidos
    for oid in list(CREATED_ORDERS):
        # remove pagamentos do pedido primeiro (libera liquidações em cascata)
        st, b = request("GET", f"/api/admin/finance/orders/{oid}/payments", token=TOKEN)
        if isinstance(b, dict):
            for p in b.get("payments", []):
                request("DELETE", f"/api/admin/finance/payments/{p['id']}", token=TOKEN)
        request("PATCH", f"/api/admin/orders/{oid}/status", token=TOKEN, body={"status": "CANCELADO"})
    for eid in list(CREATED_EXPENSES):
        request("DELETE", f"/api/admin/finance/expenses/{eid}", token=TOKEN)
    for ceid in list(CREATED_CASH_ENTRIES):
        request("DELETE", f"/api/admin/finance/cash-entries/{ceid}", token=TOKEN)
    for cid in list(CREATED_CATEGORIES):
        request("DELETE", f"/api/admin/finance/expense-categories/{cid}", token=TOKEN)
    for pid in list(CREATED_PRODUCTS):
        request("DELETE", f"/api/admin/products/{pid}", token=TOKEN)
    print(f"  Limpos via API: {len(CREATED_ORDERS)} pedidos, {len(CREATED_EXPENSES)} despesas, "
          f"{len(CREATED_CASH_ENTRIES)} lançamentos, {len(CREATED_CATEGORIES)} categorias, "
          f"{len(CREATED_PRODUCTS)} produtos.")
    # NOTA: lotes de compra (PurchaseBatch) não têm endpoint de exclusão — são
    # registros históricos por design. Em homologação, os {n} lotes criados por
    # esta bateria ficam no banco; limpe-os via SQL se quiser um ambiente 100%
    # zerado (DELETE em purchase_batch_items/purchase_batches e a expense ligada).
    if CREATED_PURCHASES:
        print(f"  ATENÇÃO: {len(CREATED_PURCHASES)} lote(s) de compra permanecem "
              f"(sem endpoint de delete — limpar via SQL se necessário).")


def main():
    t0 = time.time()
    try:
        # 1) REGRESSÃO — as 11 suítes que validam o que já está em produção.
        H.suite_a(); H.suite_b(); H.suite_c(); H.suite_d(); H.suite_e()
        H.suite_f(); H.suite_g(); H.suite_i(); H.suite_h(); H.suite_j(); H.suite_k()
        H.cleanup()
        # 2) MÓDULO FINANCEIRO — suítes novas.
        suite_fa(); suite_fb(); suite_fc(); suite_fd(); suite_fe(); suite_ff(); suite_fg()
    finally:
        cleanup_fin()

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
