#!/usr/bin/env python3
"""
Bateria de QA da feature METAS MENSAIS + VISÃO GERAL (overview).
Perfil: QA sênior. Cobre densamente:
  - /api/admin/overview: forma do payload, tipos, coerência de contagens/alertas,
    série de 6 meses (sempre 6 pontos, ordem cronológica), progresso vs meta.
  - /api/admin/goals: criação livre, TRAVA (alteração exige justificativa),
    auditoria (goal_change_logs), herança da última meta <= mês, validações
    (ano/mês/targets), RBAC (sem sessão -> 401/403).
Parametrizável por env: QA_BASE, QA_ADMIN_EMAIL, QA_ADMIN_PASS.
Sem dependências externas (stdlib). Limpa 100% dos dados de teste ao final.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import http.cookiejar

BASE = os.environ.get("QA_BASE", "http://localhost:8081")
ADMIN_EMAIL = os.environ.get("QA_ADMIN_EMAIL", "admin@homolog.com")
ADMIN_PASS = os.environ.get("QA_ADMIN_PASS", "homolog123")

# Anos usados só para teste (bem no futuro, para não colidir com dados reais).
# Limpos no final via API e via checagem.
TEST_YEARS = [2093, 2094, 2095]


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

_cookie_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cookie_jar))


def request(method, path, body=None, headers=None, no_cookie=False):
    url = BASE + path
    data = None
    hdrs = headers or {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
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
    st, b = request("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if st == 200 and isinstance(b, dict) and b.get("id"):
        jwt_cookie = next((c.value for c in _cookie_jar if c.name == "jwt"), None)
        if jwt_cookie:
            return jwt_cookie
        if b.get("token"):
            return b["token"]
    print(f"FATAL: login admin falhou (status={st}, body={b})")
    sys.exit(1)


def is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


# ===========================================================================
# SUÍTE M1 — RBAC: metas e overview exigem ROLE_ADMIN
# ===========================================================================
def suite_rbac():
    print("== SUÍTE M1: RBAC metas/overview ==")
    protected = [
        ("GET", "/api/admin/overview"),
        ("GET", "/api/admin/goals/current"),
        ("GET", "/api/admin/goals?year=2026&month=1"),
        ("GET", "/api/admin/goals/history"),
        ("GET", "/api/admin/goals/changes?year=2026&month=1"),
        ("PUT", "/api/admin/goals"),
    ]
    for method, path in protected:
        body = {"year": 2026, "month": 1, "revenueTarget": 1} if method == "PUT" else None
        st, _ = request(method, path, body=body, no_cookie=True)
        R.check(f"M1.sem_sessao.{method}.{path}", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE M2 — Overview: forma, tipos e coerência
# ===========================================================================
def suite_overview_shape():
    print("== SUÍTE M2: Overview forma/tipos/coerência ==")
    st, ov = request("GET", "/api/admin/overview")
    R.check("M2.overview.status200", st == 200, 200, st)
    if not isinstance(ov, dict):
        R.check("M2.overview.is_dict", False, "dict", type(ov).__name__)
        return

    # Campos de topo
    for key in ("year", "month", "month_kpis", "goal", "progress", "orders", "counts", "alerts", "revenue6m"):
        R.check(f"M2.overview.tem.{key}", key in ov, "presente", "ausente")

    R.check("M2.overview.year_int", is_number(ov.get("year")), "number", ov.get("year"))
    R.check("M2.overview.month_1a12", 1 <= (ov.get("month") or 0) <= 12, "1..12", ov.get("month"))

    mk = ov.get("month_kpis") or {}
    for key in ("revenue", "orders", "items", "averageTicket", "margin", "marginPercent"):
        R.check(f"M2.month_kpis.{key}.number", is_number(mk.get(key)), "number", mk.get(key))
    R.check("M2.month_kpis.revenue_nao_negativo", (mk.get("revenue") or 0) >= 0, ">=0", mk.get("revenue"))
    R.check("M2.month_kpis.orders_nao_negativo", (mk.get("orders") or 0) >= 0, ">=0", mk.get("orders"))

    # counts coerentes com endpoints diretos
    counts = ov.get("counts") or {}
    R.check("M2.counts.products.number", is_number(counts.get("products")), "number", counts.get("products"))
    R.check("M2.counts.consignees.number", is_number(counts.get("consignees")), "number", counts.get("consignees"))
    st_p, prods = request("GET", "/api/admin/products")
    if isinstance(prods, list):
        R.check("M2.counts.products.bate_com_lista", counts.get("products") == len(prods),
                len(prods), counts.get("products"))
    st_c, cons = request("GET", "/api/consignees")
    if isinstance(cons, list):
        R.check("M2.counts.consignees.bate_com_lista", counts.get("consignees") == len(cons),
                len(cons), counts.get("consignees"))

    # orders summary coerente
    orders = ov.get("orders") or {}
    st_o, summ = request("GET", "/api/admin/orders/summary")
    if isinstance(summ, dict):
        R.check("M2.orders.pendente.bate", orders.get("pendente") == summ.get("pendente"),
                summ.get("pendente"), orders.get("pendente"))
        R.check("M2.orders.confirmado.bate", orders.get("confirmado") == summ.get("confirmado"),
                summ.get("confirmado"), orders.get("confirmado"))
        R.check("M2.orders.cancelado.bate", orders.get("cancelado") == summ.get("cancelado"),
                summ.get("cancelado"), orders.get("cancelado"))

    # alerts: lowStock bate com /stock/low; garantia com /stock/warranty
    alerts = ov.get("alerts") or {}
    st_l, low = request("GET", "/api/admin/stock/low")
    if isinstance(low, list):
        R.check("M2.alerts.lowStock.bate", alerts.get("lowStock") == len(low), len(low), alerts.get("lowStock"))
    st_w, war = request("GET", "/api/admin/stock/warranty?days=60")
    if isinstance(war, dict):
        R.check("M2.alerts.warrantyExpired.bate",
                alerts.get("warrantyExpired") == len(war.get("expired", [])),
                len(war.get("expired", [])), alerts.get("warrantyExpired"))
        R.check("M2.alerts.warrantyExpiring.bate",
                alerts.get("warrantyExpiring") == len(war.get("expiring", [])),
                len(war.get("expiring", [])), alerts.get("warrantyExpiring"))

    # revenue6m: exatamente 6 pontos, ordem cronológica crescente, período yyyy-MM
    r6 = ov.get("revenue6m")
    R.check("M2.revenue6m.is_list", isinstance(r6, list), "list", type(r6).__name__)
    if isinstance(r6, list):
        R.check("M2.revenue6m.tem_6_pontos", len(r6) == 6, 6, len(r6))
        periods = [p.get("period") for p in r6 if isinstance(p, dict)]
        R.check("M2.revenue6m.periodos_formato", all(
            isinstance(p, str) and len(p) == 7 and p[4] == "-" for p in periods),
            "yyyy-MM", periods)
        R.check("M2.revenue6m.ordem_crescente", periods == sorted(periods), "crescente", periods)
        # último ponto = mês vigente do overview
        if periods:
            expected_last = f"{ov.get('year'):04d}-{ov.get('month'):02d}"
            R.check("M2.revenue6m.ultimo_eh_mes_vigente", periods[-1] == expected_last,
                    expected_last, periods[-1])
        for p in r6:
            if isinstance(p, dict):
                R.check(f"M2.revenue6m.{p.get('period')}.revenue_number", is_number(p.get("revenue")),
                        "number", p.get("revenue"))
                R.check(f"M2.revenue6m.{p.get('period')}.orders_nao_neg", (p.get("orders") or 0) >= 0,
                        ">=0", p.get("orders"))


# ===========================================================================
# SUÍTE M3 — Metas: criação, trava, auditoria
# ===========================================================================
def suite_goals_crud():
    print("== SUÍTE M3: Metas criação/trava/auditoria ==")
    y = TEST_YEARS[0]

    # M3.1 Criação livre (sem justificativa) para todos os 12 meses do ano de teste
    for m in range(1, 13):
        st, b = request("PUT", "/api/admin/goals",
                        body={"year": y, "month": m, "revenueTarget": 1000 * m, "ordersTarget": m})
        R.check(f"M3.criar.{y}-{m:02d}.status200", st == 200, 200, st)
        if isinstance(b, dict):
            R.check(f"M3.criar.{y}-{m:02d}.locked_true", b.get("locked") is True, True, b.get("locked"))
            R.check(f"M3.criar.{y}-{m:02d}.revenue", float(b.get("revenueTarget") or -1) == 1000 * m,
                    1000 * m, b.get("revenueTarget"))
            R.check(f"M3.criar.{y}-{m:02d}.orders", b.get("ordersTarget") == m, m, b.get("ordersTarget"))
            R.check(f"M3.criar.{y}-{m:02d}.inherited_false", b.get("inherited") is False, False, b.get("inherited"))

    # M3.2 Alterar meta existente SEM justificativa -> 400 (trava) para cada mês
    for m in range(1, 13):
        st, b = request("PUT", "/api/admin/goals",
                        body={"year": y, "month": m, "revenueTarget": 9999, "ordersTarget": 99})
        R.check(f"M3.alterar_sem_reason.{y}-{m:02d}.400", st == 400, 400, st)
        R.check(f"M3.alterar_sem_reason.{y}-{m:02d}.mensagem",
                isinstance(b, dict) and "justificativa" in (b.get("error", "").lower()),
                "menção a justificativa", b.get("error") if isinstance(b, dict) else b)

    # M3.3 Alterar meta com justificativa em branco (só espaços) -> 400
    st, b = request("PUT", "/api/admin/goals",
                    body={"year": y, "month": 1, "revenueTarget": 5000, "ordersTarget": 50, "changeReason": "   "})
    R.check("M3.alterar_reason_vazio.400", st == 400, 400, st)

    # M3.4 Alterar COM justificativa -> 200 e gera auditoria
    for m in range(1, 13):
        st, b = request("PUT", "/api/admin/goals",
                        body={"year": y, "month": m, "revenueTarget": 2000 * m, "ordersTarget": m + 100,
                              "changeReason": f"reajuste QA mes {m}"})
        R.check(f"M3.alterar_ok.{y}-{m:02d}.200", st == 200, 200, st)
        if isinstance(b, dict):
            R.check(f"M3.alterar_ok.{y}-{m:02d}.revenue_novo", float(b.get("revenueTarget") or -1) == 2000 * m,
                    2000 * m, b.get("revenueTarget"))

    # M3.5 Auditoria: cada mês alterado tem >=1 registro com old/new corretos
    for m in range(1, 13):
        st, logs = request("GET", f"/api/admin/goals/changes?year={y}&month={m}")
        R.check(f"M3.auditoria.{y}-{m:02d}.tem_registro", isinstance(logs, list) and len(logs) >= 1,
                ">=1 registro", len(logs) if isinstance(logs, list) else logs)
        if isinstance(logs, list) and logs:
            last = logs[0]  # mais recente primeiro
            R.check(f"M3.auditoria.{y}-{m:02d}.old_revenue", float(last.get("oldRevenueTarget") or -1) == 1000 * m,
                    1000 * m, last.get("oldRevenueTarget"))
            R.check(f"M3.auditoria.{y}-{m:02d}.new_revenue", float(last.get("newRevenueTarget") or -1) == 2000 * m,
                    2000 * m, last.get("newRevenueTarget"))
            R.check(f"M3.auditoria.{y}-{m:02d}.reason_gravado",
                    isinstance(last.get("reason"), str) and "reajuste QA" in last.get("reason"),
                    "reason gravado", last.get("reason"))

    # M3.6 Alteração idempotente (mesmos valores) com justificativa: não deve criar novo log
    st, logs_before = request("GET", f"/api/admin/goals/changes?year={y}&month=1")
    n_before = len(logs_before) if isinstance(logs_before, list) else -1
    request("PUT", "/api/admin/goals",
            body={"year": y, "month": 1, "revenueTarget": 2000, "ordersTarget": 101, "changeReason": "sem mudanca real"})
    st, logs_after = request("GET", f"/api/admin/goals/changes?year={y}&month=1")
    n_after = len(logs_after) if isinstance(logs_after, list) else -2
    R.check("M3.auditoria.idempotente.sem_novo_log", n_after == n_before, n_before, n_after)


# ===========================================================================
# SUÍTE M4 — Herança da última meta <= mês
# ===========================================================================
def suite_inheritance():
    print("== SUÍTE M4: Herança de metas ==")
    y = TEST_YEARS[1]  # ano limpo, sem metas ainda

    # Sem nenhuma meta no ano: consultar mês 6 -> herda de TEST_YEARS[0] (ano anterior tem metas)
    # mas para isolar, primeiro garantimos que ano anterior (TEST_YEARS[0]) tem metas (suite_goals_crud rodou).
    # Cria meta só em março (mês 3) de y.
    st, _ = request("PUT", "/api/admin/goals",
                    body={"year": y, "month": 3, "revenueTarget": 30000, "ordersTarget": 300})
    R.check("M4.setup.criar_marco.200", st == 200, 200, st)

    # Mês 3 (exato): meta própria, inherited=false
    st, b = request("GET", f"/api/admin/goals?year={y}&month=3")
    R.check("M4.marco.exato.inherited_false", isinstance(b, dict) and b.get("inherited") is False,
            False, b.get("inherited") if isinstance(b, dict) else b)
    R.check("M4.marco.exato.revenue", isinstance(b, dict) and float(b.get("revenueTarget") or -1) == 30000,
            30000, b.get("revenueTarget") if isinstance(b, dict) else b)

    # Meses 4..12: herdam a de março (30000/300), inherited=true, reportando o mês consultado
    for m in range(4, 13):
        st, b = request("GET", f"/api/admin/goals?year={y}&month={m}")
        R.check(f"M4.herda.{y}-{m:02d}.inherited_true", isinstance(b, dict) and b.get("inherited") is True,
                True, b.get("inherited") if isinstance(b, dict) else b)
        R.check(f"M4.herda.{y}-{m:02d}.revenue_herdado",
                isinstance(b, dict) and float(b.get("revenueTarget") or -1) == 30000, 30000,
                b.get("revenueTarget") if isinstance(b, dict) else b)
        R.check(f"M4.herda.{y}-{m:02d}.reporta_mes", isinstance(b, dict) and b.get("month") == m, m,
                b.get("month") if isinstance(b, dict) else b)

    # Meses 1..2 de y: NÃO há meta <= esse mês em y, mas há em TEST_YEARS[0] (dez).
    # Como a herança é global (última meta <= alvo por year*12+month), herda de dez/TEST_YEARS[0].
    for m in range(1, 3):
        st, b = request("GET", f"/api/admin/goals?year={y}&month={m}")
        R.check(f"M4.herda_ano_anterior.{y}-{m:02d}.inherited_true",
                isinstance(b, dict) and b.get("inherited") is True, True,
                b.get("inherited") if isinstance(b, dict) else b)
        # dez/TEST_YEARS[0] foi alterado para 2000*12=24000
        R.check(f"M4.herda_ano_anterior.{y}-{m:02d}.revenue_dez_anterior",
                isinstance(b, dict) and float(b.get("revenueTarget") or -1) == 24000, 24000,
                b.get("revenueTarget") if isinstance(b, dict) else b)

    # Definir meta posterior (mês 8) muda a herança dos meses >= 8, mas não dos < 8
    request("PUT", "/api/admin/goals", body={"year": y, "month": 8, "revenueTarget": 80000, "ordersTarget": 800})
    st, b7 = request("GET", f"/api/admin/goals?year={y}&month=7")
    R.check("M4.pos_insercao.mes7_ainda_marco", isinstance(b7, dict) and float(b7.get("revenueTarget") or -1) == 30000,
            30000, b7.get("revenueTarget") if isinstance(b7, dict) else b7)
    st, b9 = request("GET", f"/api/admin/goals?year={y}&month=9")
    R.check("M4.pos_insercao.mes9_herda_agosto", isinstance(b9, dict) and float(b9.get("revenueTarget") or -1) == 80000,
            80000, b9.get("revenueTarget") if isinstance(b9, dict) else b9)


# ===========================================================================
# SUÍTE M5 — Validações de entrada
# ===========================================================================
def suite_validation():
    print("== SUÍTE M5: Validações ==")
    y = TEST_YEARS[2]
    invalid = [
        ("mes_0", {"year": y, "month": 0, "revenueTarget": 1}),
        ("mes_13", {"year": y, "month": 13, "revenueTarget": 1}),
        ("mes_negativo", {"year": y, "month": -1, "revenueTarget": 1}),
        ("ano_1999", {"year": 1999, "month": 1, "revenueTarget": 1}),
        ("ano_2101", {"year": 2101, "month": 1, "revenueTarget": 1}),
        ("ano_null", {"month": 1, "revenueTarget": 1}),
        ("mes_null", {"year": y, "revenueTarget": 1}),
        ("revenue_negativo", {"year": y, "month": 5, "revenueTarget": -10}),
        ("orders_negativo", {"year": y, "month": 5, "ordersTarget": -5}),
    ]
    for name, body in invalid:
        st, _ = request("PUT", "/api/admin/goals", body=body)
        R.check(f"M5.invalido.{name}.400", st == 400, 400, st)

    # Válido: targets nulos são aceitos (meta parcial) — cria mês 6 só com receita
    st, b = request("PUT", "/api/admin/goals", body={"year": y, "month": 6, "revenueTarget": 5000})
    R.check("M5.valido.so_receita.200", st == 200, 200, st)
    R.check("M5.valido.so_receita.orders_null", isinstance(b, dict) and b.get("ordersTarget") is None,
            None, b.get("ordersTarget") if isinstance(b, dict) else b)

    # Válido: só pedidos
    st, b = request("PUT", "/api/admin/goals", body={"year": y, "month": 7, "ordersTarget": 42})
    R.check("M5.valido.so_pedidos.200", st == 200, 200, st)
    R.check("M5.valido.so_pedidos.revenue_null", isinstance(b, dict) and b.get("revenueTarget") is None,
            None, b.get("revenueTarget") if isinstance(b, dict) else b)

    # Válido: target zero é permitido (@PositiveOrZero)
    st, b = request("PUT", "/api/admin/goals", body={"year": y, "month": 8, "revenueTarget": 0, "ordersTarget": 0})
    R.check("M5.valido.target_zero.200", st == 200, 200, st)


# ===========================================================================
# SUÍTE M6 — Progresso vs meta no overview (mês vigente)
# ===========================================================================
def suite_progress():
    print("== SUÍTE M6: Progresso vs meta (mês vigente) ==")
    st, ov = request("GET", "/api/admin/overview")
    if not isinstance(ov, dict):
        R.check("M6.overview_dict", False, "dict", type(ov).__name__)
        return
    cy, cm = ov.get("year"), ov.get("month")

    # Sem meta no mês vigente (garantindo que não haja): progresso null
    # (não criamos meta no ano/mês vigente real; os testes usam anos futuros)
    prog = ov.get("progress") or {}
    goal = ov.get("goal") or {}
    if not goal.get("revenueTarget"):
        R.check("M6.sem_meta.revenuePercent_null", prog.get("revenuePercent") is None, None, prog.get("revenuePercent"))
    if not goal.get("ordersTarget"):
        R.check("M6.sem_meta.ordersPercent_null", prog.get("ordersPercent") is None, None, prog.get("ordersPercent"))

    # Cria meta para o mês VIGENTE real e valida que o progresso passa a ser numérico
    # revenueTarget alto para não dividir por zero; orders idem.
    st, _ = request("PUT", "/api/admin/goals",
                    body={"year": cy, "month": cm, "revenueTarget": 123456, "ordersTarget": 789})
    # se já existia (criada por engano), tenta com reason
    if st == 400:
        request("PUT", "/api/admin/goals",
                body={"year": cy, "month": cm, "revenueTarget": 123456, "ordersTarget": 789,
                      "changeReason": "QA progresso"})
    st, ov2 = request("GET", "/api/admin/overview")
    prog2 = ov2.get("progress") or {}
    mk = ov2.get("month_kpis") or {}
    R.check("M6.com_meta.revenuePercent_number", is_number(prog2.get("revenuePercent")),
            "number", prog2.get("revenuePercent"))
    R.check("M6.com_meta.ordersPercent_number", is_number(prog2.get("ordersPercent")),
            "number", prog2.get("ordersPercent"))
    # Coerência: revenuePercent == revenue/target*100 (1 casa)
    if is_number(prog2.get("revenuePercent")):
        expected = round((mk.get("revenue") or 0) / 123456 * 100, 1)
        R.check("M6.com_meta.revenuePercent_coerente", abs(prog2.get("revenuePercent") - expected) < 0.2,
                expected, prog2.get("revenuePercent"))
    if is_number(prog2.get("ordersPercent")):
        expected_o = round((mk.get("orders") or 0) / 789 * 100, 1)
        R.check("M6.com_meta.ordersPercent_coerente", abs(prog2.get("ordersPercent") - expected_o) < 0.2,
                expected_o, prog2.get("ordersPercent"))
    # goal do overview reflete a meta criada (não herdada)
    g2 = ov2.get("goal") or {}
    R.check("M6.com_meta.goal_nao_herdado", g2.get("inherited") is False, False, g2.get("inherited"))
    R.check("M6.com_meta.goal_locked", g2.get("locked") is True, True, g2.get("locked"))


# ===========================================================================
# Cleanup — remove todas as metas e logs dos anos de teste + mês vigente
# ===========================================================================
def cleanup():
    print("\n== CLEANUP ==")
    import subprocess
    db = os.environ.get("QA_DB", "hesed_homolog")
    years = ",".join(str(y) for y in TEST_YEARS)
    # remove metas do mês vigente criada no M6 também
    st, ov = request("GET", "/api/admin/overview")
    cy = ov.get("year") if isinstance(ov, dict) else None
    cm = ov.get("month") if isinstance(ov, dict) else None
    sql = f"DELETE FROM goal_change_logs WHERE goal_year IN ({years}); " \
          f"DELETE FROM monthly_goals WHERE goal_year IN ({years});"
    if cy and cm:
        sql += f" DELETE FROM goal_change_logs WHERE goal_year={cy} AND goal_month={cm};" \
               f" DELETE FROM monthly_goals WHERE goal_year={cy} AND goal_month={cm};"
    r = subprocess.run(["psql", "-d", db, "-c", sql], capture_output=True, text=True)
    print(f"  psql cleanup rc={r.returncode} {r.stdout.strip()} {r.stderr.strip()}")

    # Verifica que não sobrou meta dos anos de teste
    st, hist = request("GET", "/api/admin/goals/history")
    leaked = [g for g in hist if isinstance(g, dict) and g.get("year") in TEST_YEARS] if isinstance(hist, list) else ["?"]
    R.check("CLEANUP.sem_metas_teste_remanescentes", len(leaked) == 0, "0", len(leaked))


def main():
    t0 = time.time()
    admin_login()
    print("Login admin homolog OK. Iniciando bateria de METAS...\n")
    try:
        suite_rbac()
        suite_overview_shape()
        suite_goals_crud()
        suite_inheritance()
        suite_validation()
        suite_progress()
    finally:
        cleanup()
    dt = time.time() - t0
    total = R.passed + R.failed
    print("\n" + "=" * 60)
    print(f"TOTAL METAS: {total} testes | PASS: {R.passed} | FAIL: {R.failed} | {dt:.1f}s")
    print("=" * 60)
    if R.failures:
        print("\nFALHAS:")
        for name, exp, got in R.failures:
            print(f"  - {name}: esperado={exp} obtido={got}")
    sys.exit(0 if R.failed == 0 else 1)


if __name__ == "__main__":
    main()
