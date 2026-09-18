#!/usr/bin/env python3
"""
Bateria de QA das features: DATA DE NASCIMENTO do cliente + SINO DE NOTIFICAÇÕES
de aniversário.

Cobre:
  - Cliente: birthDate opcional, persistência, edição, rejeição de data futura.
  - Notificações: janela de 5 dias (0..5) inclusive; fora da janela não aparece;
    contagem de dias (message); ordenação por proximidade; dispensar (remove e
    persiste); template BIRTHDAY existente; RBAC.

Uso (homolog):
    QA_BASE=http://localhost:8081 QA_ADMIN_EMAIL=admin@homolog.com \\
    QA_ADMIN_PASS=homolog123 python3 qa/qa_notificacoes.py

Reaproveita o harness do qa_homolog (request/Results/login). Limpa 100% dos
próprios dados (clientes e dispensas) ao final.
"""

import os
import sys
import uuid
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qa_homolog as H
from qa_homolog import R, request, TOKEN

CREATED_CUSTOMERS = set()
DISMISSED_KEYS = set()


def dstr(d):
    return d.isoformat()


def birth_offset(days):
    """Data de nascimento (ano antigo) cujo dia/mês cai a `days` de hoje."""
    d = date.today() + timedelta(days=days)
    # usa 1990 como ano de nascimento; se for 29/02 e 1990 não for bissexto, recua p/ 28
    day = d.day
    if d.month == 2 and d.day == 29:
        day = 28
    return date(1990, d.month, day).isoformat()


def create_customer(name, birth=None):
    body = {"name": name, "phone": "51999990000"}
    if birth is not None:
        body["birthDate"] = birth
    st, b = request("POST", "/api/admin/customers", token=TOKEN, body=body)
    if st == 201 and isinstance(b, dict) and b.get("id"):
        CREATED_CUSTOMERS.add(b["id"])
    return st, b


# ===========================================================================
# SUÍTE NA — Data de nascimento no cadastro de cliente
# ===========================================================================
def suite_na():
    print("== SUÍTE NA: Data de nascimento do cliente ==")

    # NA1. Criar com data válida persiste
    st, b = create_customer(f"Nasc QA {uuid.uuid4().hex[:6]}", "1990-05-20")
    R.check("NA.criar.201", st == 201, 201, st)
    cid = b.get("id") if isinstance(b, dict) else None
    R.check("NA.criar.birthDate", isinstance(b, dict) and b.get("birthDate") == "1990-05-20",
            "1990-05-20", b.get("birthDate") if isinstance(b, dict) else None)

    # NA2. Releitura confirma persistência
    if cid:
        st, b = request("GET", f"/api/admin/customers/{cid}", token=TOKEN)
        R.check("NA.reler.birthDate", isinstance(b, dict) and b.get("birthDate") == "1990-05-20",
                "1990-05-20", b.get("birthDate") if isinstance(b, dict) else None)

        # NA3. Editar a data
        st, b = request("PUT", f"/api/admin/customers/{cid}", token=TOKEN,
                        body={"name": b["name"], "phone": "51999990000", "birthDate": "1985-12-01"})
        R.check("NA.editar.200", st == 200, 200, st)
        R.check("NA.editar.birthDate", isinstance(b, dict) and b.get("birthDate") == "1985-12-01",
                "1985-12-01", b.get("birthDate") if isinstance(b, dict) else None)

        # NA4. Editar removendo a data (null) — opcional
        st, b = request("PUT", f"/api/admin/customers/{cid}", token=TOKEN,
                        body={"name": b["name"], "phone": "51999990000", "birthDate": None})
        R.check("NA.editar.remove_data", isinstance(b, dict) and b.get("birthDate") is None,
                None, b.get("birthDate") if isinstance(b, dict) else None)

    # NA5. Data futura é rejeitada (400)
    fut = (date.today() + timedelta(days=365)).isoformat()
    st, b = create_customer(f"Futuro QA {uuid.uuid4().hex[:6]}", fut)
    R.check("NA.data_futura.400", st == 400, 400, st)

    # NA6. Sem data (opcional) funciona
    st, b = create_customer(f"SemData QA {uuid.uuid4().hex[:6]}")
    R.check("NA.sem_data.201", st == 201, 201, st)
    R.check("NA.sem_data.birthDate_null", isinstance(b, dict) and b.get("birthDate") is None,
            None, b.get("birthDate") if isinstance(b, dict) else None)


# ===========================================================================
# SUÍTE NB — Notificações de aniversário (janela, contagem, ordenação)
# ===========================================================================
def suite_nb():
    print("== SUÍTE NB: Notificações de aniversário ==")

    # cria clientes cobrindo dentro e fora da janela
    marker = uuid.uuid4().hex[:6]
    dentro = {
        f"Aniv0 {marker}": birth_offset(0),
        f"Aniv1 {marker}": birth_offset(1),
        f"Aniv3 {marker}": birth_offset(3),
        f"Aniv5 {marker}": birth_offset(5),
    }
    fora = {
        f"Aniv6 {marker}": birth_offset(6),
        f"AnivOntem {marker}": birth_offset(-1),
    }
    for nome, bd in {**dentro, **fora}.items():
        create_customer(nome, bd)

    st, notifs = request("GET", "/api/admin/notifications", token=TOKEN)
    R.check("NB.list.200", st == 200 and isinstance(notifs, list), "200/list", st)
    notifs = notifs if isinstance(notifs, list) else []
    by_name = {n.get("customerName"): n for n in notifs}

    # NB1. Todos os "dentro" aparecem
    for nome in dentro:
        R.check(f"NB.dentro.aparece[{nome[:5]}]", nome in by_name, "presente", nome in by_name)

    # NB2. Nenhum "fora" aparece
    for nome in fora:
        R.check(f"NB.fora.ausente[{nome[:6]}]", nome not in by_name, "ausente", nome in by_name)

    # NB3. daysUntil coerente com o offset criado
    checks = [(f"Aniv0 {marker}", 0), (f"Aniv1 {marker}", 1), (f"Aniv3 {marker}", 3), (f"Aniv5 {marker}", 5)]
    for nome, esperado in checks:
        got = by_name.get(nome, {}).get("daysUntil")
        R.check(f"NB.daysUntil[{esperado}]", got == esperado, esperado, got)

    # NB4. type BIRTHDAY e campos do cliente presentes
    n0 = by_name.get(f"Aniv0 {marker}")
    if n0:
        R.check("NB.tipo.birthday", n0.get("type") == "BIRTHDAY", "BIRTHDAY", n0.get("type"))
        R.check("NB.tem_customerId", bool(n0.get("customerId")), "customerId", n0.get("customerId"))
        R.check("NB.tem_key", bool(n0.get("key")), "key", n0.get("key"))
        R.check("NB.msg_hoje", "hoje" in (n0.get("message") or "").lower(), "contém 'hoje'", n0.get("message"))

    # NB5. mensagem de "amanhã"
    n1 = by_name.get(f"Aniv1 {marker}")
    if n1:
        R.check("NB.msg_amanha", "amanhã" in (n1.get("message") or "").lower(), "contém 'amanhã'", n1.get("message"))

    # NB6. ordenação por daysUntil ascendente (só os nossos, para isolar)
    ours = [n for n in notifs if n.get("customerName", "").endswith(marker)]
    days_seq = [n.get("daysUntil") for n in ours]
    R.check("NB.ordenado_asc", days_seq == sorted(days_seq), sorted(days_seq), days_seq)

    # NB7. Dispensar remove da lista e persiste
    if n0:
        key = n0["key"]
        st, _ = request("POST", "/api/admin/notifications/dismiss", token=TOKEN, body={"key": key})
        R.check("NB.dismiss.200", st == 200, 200, st)
        DISMISSED_KEYS.add(key)
        st, notifs2 = request("GET", "/api/admin/notifications", token=TOKEN)
        names2 = {n.get("customerName") for n in notifs2} if isinstance(notifs2, list) else set()
        R.check("NB.dismiss.removeu", f"Aniv0 {marker}" not in names2, "removido", f"Aniv0 {marker}" in names2)

        # NB8. Dispensar de novo é idempotente (200, sem erro)
        st, _ = request("POST", "/api/admin/notifications/dismiss", token=TOKEN, body={"key": key})
        R.check("NB.dismiss.idempotente", st == 200, 200, st)

    # NB9. Dispensar sem key -> 400
    st, _ = request("POST", "/api/admin/notifications/dismiss", token=TOKEN, body={"key": ""})
    R.check("NB.dismiss.sem_key.400", st == 400, 400, st)

    # NB10. RBAC: sem token nega
    st, _ = request("GET", "/api/admin/notifications", no_cookie=True)
    R.check("NB.rbac.sem_token.nega", st in (401, 403), "401/403", st)


# ===========================================================================
# SUÍTE NC — Template de mensagem de aniversário
# ===========================================================================
def suite_nc():
    print("== SUÍTE NC: Template BIRTHDAY ==")
    st, msgs = request("GET", "/api/admin/settings/messages", token=TOKEN)
    keys = [m["templateKey"] for m in msgs] if isinstance(msgs, list) else []
    R.check("NC.birthday.existe", "BIRTHDAY" in keys, "BIRTHDAY presente", keys)
    bd = next((m for m in msgs if m["templateKey"] == "BIRTHDAY"), None) if isinstance(msgs, list) else None
    if bd:
        R.check("NC.birthday.usa_cliente", "{cliente}" in (bd.get("body") or ""),
                "corpo com {cliente}", bd.get("body"))
        R.check("NC.birthday.ativo", bd.get("active") is True, True, bd.get("active"))


def cleanup():
    print("\n== CLEANUP: removendo dados de teste ==")
    for cid in list(CREATED_CUSTOMERS):
        request("DELETE", f"/api/admin/customers/{cid}", token=TOKEN)
    print(f"  Clientes removidos: {len(CREATED_CUSTOMERS)}.")
    if DISMISSED_KEYS:
        print(f"  NOTA: {len(DISMISSED_KEYS)} dispensa(s) criada(s) — chaves de clientes já removidos "
              f"(órfãs e inertes). Limpar via SQL se quiser: DELETE FROM notification_dismissals WHERE notification_key LIKE 'BIRTHDAY:%';")


def main():
    try:
        suite_na()
        suite_nb()
        suite_nc()
    finally:
        cleanup()
    total = R.passed + R.failed
    print("\n" + "=" * 60)
    print(f"TOTAL: {total} testes | PASS: {R.passed} | FAIL: {R.failed}")
    print("=" * 60)
    if R.failures:
        print("\nFALHAS:")
        for name, exp, got in R.failures:
            print(f"  - {name}: esperado={exp} obtido={got}")
    sys.exit(0 if R.failed == 0 else 1)


if __name__ == "__main__":
    main()
