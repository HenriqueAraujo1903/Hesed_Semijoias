import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { BRL } from '../utils/format';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
}

interface Installment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  paidAt: string | null;
}

interface Expense {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  supplierId: string | null;
  supplierName: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  competenceDate: string;
  installmentsCount: number;
  status: 'PENDENTE' | 'PARCIAL' | 'PAGO';
  notes: string | null;
  installments: Installment[];
}

interface Supplier { id: string; name: string; }

interface CashEntry {
  id: string;
  type: 'ENTRADA' | 'SAIDA';
  description: string;
  amount: number;
  entryDate: string;
  notes: string | null;
}

interface CashFlowMovement {
  date: string;
  type: 'ENTRADA' | 'SAIDA';
  source: 'PAGAMENTO' | 'DESPESA' | 'TAXA' | 'MANUAL';
  description: string;
  amount: number;
}

interface CashFlow {
  totalInflow: number;
  totalOutflow: number;
  net: number;
  movements: CashFlowMovement[];
}

interface IncomeStatement {
  year: number;
  month: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPercent: number;
  consignmentCommissions: number;
  paymentFees: number;
  operatingExpenses: number;
  netResult: number;
  netResultPercent: number;
  expensesByCategory: { category: string; total: number }[];
}

type Tab = 'fluxo' | 'contas' | 'dre';

const TABS: { key: Tab; label: string }[] = [
  { key: 'fluxo', label: 'Fluxo de Caixa' },
  { key: 'contas', label: 'Contas a Pagar' },
  { key: 'dre', label: 'DRE' },
];

const EXPENSE_STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDENTE: { label: 'Pendente', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  PARCIAL: { label: 'Parcial', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  PAGO: { label: 'Pago', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  ATRASADO: { label: 'Atrasado', badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function firstDayOfMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function lastDayOfMonth(d = new Date()): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('fluxo');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-display text-charcoal-800 dark:text-cream-200">Financeiro</h1>
        <p className="text-sm text-charcoal-400 dark:text-charcoal-500">
          Fluxo de caixa, contas a pagar e resultado do mês.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-gold text-white shadow-sm'
                : 'bg-white dark:bg-charcoal-800 text-charcoal-500 dark:text-charcoal-400 border border-charcoal-100 dark:border-charcoal-700 hover:border-gold hover:text-gold'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fluxo' && <CashFlowTab />}
      {tab === 'contas' && <PayablesTab />}
      {tab === 'dre' && <IncomeStatementTab />}
    </div>
  );
}

// ─── Aba: Fluxo de Caixa ──────────────────────────────────────────────────────

function CashFlowTab() {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(lastDayOfMonth());
  const [data, setData] = useState<CashFlow | null>(null);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [flowRes, entriesRes] = await Promise.all([
        api.get('/admin/finance/cash-flow', { params: { from, to } }),
        api.get('/admin/finance/cash-entries', { params: { from, to } }),
      ]);
      setData(flowRes.data);
      setEntries(entriesRes.data);
    } catch (e) {
      console.error('Erro ao carregar fluxo de caixa:', e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  async function deleteEntry(id: string) {
    if (!window.confirm('Excluir este lançamento manual?')) return;
    try {
      await api.delete(`/admin/finance/cash-entries/${id}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir lançamento');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <DateField label="De" value={from} onChange={setFrom} />
        <DateField label="Até" value={to} onChange={setTo} />
        <button onClick={() => setShowForm(true)} className="btn-primary ml-auto">+ Lançamento manual</button>
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Entradas" value={BRL.format(data.totalInflow)} accent="emerald" />
            <KpiCard label="Saídas" value={BRL.format(data.totalOutflow)} accent="red" />
            <KpiCard label="Saldo do período" value={BRL.format(data.net)} accent={data.net >= 0 ? 'gold' : 'red'} />
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-charcoal-100/60 dark:border-charcoal-700/60 px-4 py-3">
              <h3 className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">Extrato do período</h3>
            </div>
            {data.movements.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-charcoal-500 dark:text-charcoal-400">
                Nenhum movimento no período.
              </p>
            ) : (
              <div className="divide-y divide-charcoal-100/60 dark:divide-charcoal-700/60">
                {data.movements.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-16 shrink-0 text-xs text-charcoal-400">{fmtDate(m.date)}</span>
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-charcoal-100 dark:bg-charcoal-700 text-charcoal-500 dark:text-charcoal-300">
                      {sourceLabel(m.source)}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-charcoal-700 dark:text-charcoal-200">{m.description}</span>
                    <span className={`shrink-0 font-medium ${m.type === 'ENTRADA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {m.type === 'ENTRADA' ? '+' : '−'} {BRL.format(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {entries.length > 0 && (
            <div className="card overflow-hidden">
              <div className="border-b border-charcoal-100/60 dark:border-charcoal-700/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">Lançamentos manuais</h3>
              </div>
              <div className="divide-y divide-charcoal-100/60 dark:divide-charcoal-700/60">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-16 shrink-0 text-xs text-charcoal-400">{fmtDate(e.entryDate)}</span>
                    <span className="flex-1 min-w-0 truncate text-charcoal-700 dark:text-charcoal-200">{e.description}</span>
                    <span className={`shrink-0 font-medium ${e.type === 'ENTRADA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {e.type === 'ENTRADA' ? '+' : '−'} {BRL.format(e.amount)}
                    </span>
                    <button onClick={() => deleteEntry(e.id)} className="shrink-0 text-charcoal-300 hover:text-red-500 transition-colors" title="Excluir">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <CashEntryModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function sourceLabel(s: string): string {
  return { PAGAMENTO: 'Venda', DESPESA: 'Despesa', TAXA: 'Taxa', MANUAL: 'Manual' }[s] ?? s;
}

function CashEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'ENTRADA' | 'SAIDA'>('SAIDA');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!description.trim()) { setError('Informe a descrição.'); return; }
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { setError('Informe um valor maior que zero.'); return; }
    setLoading(true);
    try {
      await api.post('/admin/finance/cash-entries', {
        type, description: description.trim(), amount: value, entryDate, notes: notes.trim() || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao salvar lançamento');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Lançamento manual de caixa" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <FieldLabel>Tipo</FieldLabel>
          <div className="flex gap-2">
            <button onClick={() => setType('ENTRADA')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${type === 'ENTRADA' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-charcoal-200 dark:border-charcoal-600 text-charcoal-500'}`}>
              Entrada
            </button>
            <button onClick={() => setType('SAIDA')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${type === 'SAIDA' ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'border-charcoal-200 dark:border-charcoal-600 text-charcoal-500'}`}>
              Saída
            </button>
          </div>
        </div>
        <div>
          <FieldLabel>Descrição</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Ex: Aporte do sócio" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Valor (R$)</FieldLabel>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" />
          </div>
          <div>
            <FieldLabel>Data</FieldLabel>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div>
          <FieldLabel>Observações (opcional)</FieldLabel>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-4 py-2 text-sm text-charcoal-500">Cancelar</button>
          <button onClick={save} disabled={loading} className="btn-primary disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Aba: Contas a Pagar (despesas + parcelas) ────────────────────────────────

function PayablesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const res = await api.get('/admin/finance/expenses', { params });
      setExpenses(res.data);
    } catch (e) {
      console.error('Erro ao carregar despesas:', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function toggleInstallment(inst: Installment) {
    const paid = inst.status !== 'PAGO';
    try {
      await api.patch(`/admin/finance/installments/${inst.id}/paid`, {
        paid, paidDate: paid ? new Date().toISOString().slice(0, 10) : null,
      });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao atualizar parcela');
    }
  }

  async function deleteExpense(id: string) {
    if (!window.confirm('Excluir esta despesa e todas as suas parcelas?')) return;
    try {
      await api.delete(`/admin/finance/expenses/${id}`);
      await load();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Erro ao excluir despesa');
    }
  }

  const totalPending = useMemo(
    () => expenses.reduce((s, e) => s + e.remainingAmount, 0),
    [expenses]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: '', label: 'Todas' },
          { key: 'PENDENTE', label: 'Pendentes' },
          { key: 'PARCIAL', label: 'Parciais' },
          { key: 'PAGO', label: 'Pagas' },
        ].map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              statusFilter === f.key ? 'bg-gold text-white' : 'bg-white dark:bg-charcoal-800 text-charcoal-500 border border-charcoal-100 dark:border-charcoal-700 hover:border-gold hover:text-gold'
            }`}>
            {f.label}
          </button>
        ))}
        <button onClick={() => setShowForm(true)} className="btn-primary ml-auto">+ Nova despesa</button>
      </div>

      {loading ? (
        <Spinner />
      ) : expenses.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-sm text-charcoal-500 dark:text-charcoal-400">Nenhuma despesa cadastrada.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <p className="text-sm text-charcoal-500 dark:text-charcoal-400">
              Em aberto: <span className="font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(totalPending)}</span>
            </p>
          </div>
          <div className="space-y-3">
            {expenses.map((e) => {
              const isOpen = expanded === e.id;
              const meta = EXPENSE_STATUS_META[e.status];
              return (
                <div key={e.id} className="card overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-cream-100/50 dark:hover:bg-charcoal-700/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">{e.description}</span>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-charcoal-400 dark:text-charcoal-500 mt-0.5">
                        {e.categoryName}{e.supplierName ? ` • ${e.supplierName}` : ''} • {fmtDate(e.competenceDate)}
                        {e.installmentsCount > 1 ? ` • ${e.installmentsCount}x` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-200">{BRL.format(e.totalAmount)}</p>
                      {e.remainingAmount > 0 && <span className="text-[10px] text-red-500">falta {BRL.format(e.remainingAmount)}</span>}
                    </div>
                    <svg className={`h-4 w-4 text-charcoal-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="border-t border-charcoal-100/60 dark:border-charcoal-700/60 px-4 py-3 bg-cream-50/40 dark:bg-charcoal-900/20">
                      <div className="space-y-2">
                        {e.installments.map((inst) => {
                          const im = EXPENSE_STATUS_META[inst.status];
                          return (
                            <div key={inst.id} className="flex items-center gap-3 text-sm">
                              <span className="w-10 shrink-0 text-xs text-charcoal-400">{inst.installmentNumber}/{e.installmentsCount}</span>
                              <span className="w-16 shrink-0 text-xs text-charcoal-500">{fmtDate(inst.dueDate)}</span>
                              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${im.badge}`}>{im.label}</span>
                              <span className="flex-1 text-right font-medium text-charcoal-700 dark:text-charcoal-200">{BRL.format(inst.amount)}</span>
                              <button onClick={() => toggleInstallment(inst)}
                                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                                  inst.status === 'PAGO'
                                    ? 'border border-charcoal-200 dark:border-charcoal-600 text-charcoal-400 hover:text-gold'
                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                }`}>
                                {inst.status === 'PAGO' ? 'Reabrir' : 'Marcar paga'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {e.notes && <p className="mt-3 text-xs text-charcoal-500 dark:text-charcoal-400">{e.notes}</p>}
                      <div className="mt-3 pt-3 border-t border-charcoal-100/60 dark:border-charcoal-700/60 flex justify-end">
                        <button onClick={() => deleteExpense(e.id)} className="text-xs text-charcoal-400 hover:text-red-500 transition-colors">
                          Excluir despesa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showForm && (
        <ExpenseModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
      )}
    </div>
  );
}

function ExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [competenceDate, setCompetenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [installmentsCount, setInstallmentsCount] = useState('1');
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/admin/finance/expense-categories').then((r) => {
      const active = r.data.filter((c: ExpenseCategory) => c.active);
      setCategories(active);
      if (active.length > 0) setCategoryId(active[0].id);
    }).catch(() => {});
    api.get('/admin/suppliers').then((r) => setSuppliers(r.data)).catch(() => {});
  }, []);

  const count = Math.max(1, parseInt(installmentsCount, 10) || 1);
  const total = parseFloat(totalAmount) || 0;
  const perInstallment = count > 0 ? total / count : 0;

  async function save() {
    setError(null);
    if (!description.trim()) { setError('Informe a descrição.'); return; }
    if (!categoryId) { setError('Selecione a categoria.'); return; }
    if (total <= 0) { setError('Informe um valor maior que zero.'); return; }
    setLoading(true);
    try {
      await api.post('/admin/finance/expenses', {
        description: description.trim(),
        categoryId,
        supplierId: supplierId || null,
        totalAmount: total,
        competenceDate,
        installmentsCount: count,
        firstDueDate,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao salvar despesa');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Nova despesa" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <FieldLabel>Descrição</FieldLabel>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Ex: Mensalidade do sistema" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Categoria</FieldLabel>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-field">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Fornecedor (opcional)</FieldLabel>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field">
              <option value="">—</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Valor total (R$)</FieldLabel>
            <input type="number" step="0.01" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="input-field" />
          </div>
          <div>
            <FieldLabel>Competência</FieldLabel>
            <input type="date" value={competenceDate} onChange={(e) => setCompetenceDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Nº de parcelas</FieldLabel>
            <input type="number" min="1" value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)} className="input-field" />
          </div>
          <div>
            <FieldLabel>1º vencimento</FieldLabel>
            <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className="input-field" />
          </div>
        </div>
        {count > 1 && total > 0 && (
          <p className="text-xs text-charcoal-500 dark:text-charcoal-400">
            {count}x de aproximadamente <span className="font-medium">{BRL.format(perInstallment)}</span> (uma por mês a partir do 1º vencimento).
          </p>
        )}
        <div>
          <FieldLabel>Observações (opcional)</FieldLabel>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-charcoal-200 dark:border-charcoal-600 px-4 py-2 text-sm text-charcoal-500">Cancelar</button>
          <button onClick={save} disabled={loading} className="btn-primary disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Aba: DRE ─────────────────────────────────────────────────────────────────

function IncomeStatementTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/finance/income-statement', { params: { year, month } });
      setData(res.data);
    } catch (e) {
      console.error('Erro ao carregar DRE:', e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <FieldLabel>Mês</FieldLabel>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="input-field">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Ano</FieldLabel>
          <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="input-field w-28" />
        </div>
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <div className="card p-5 space-y-1 max-w-xl">
          <DreLine label="Receita de vendas" value={data.revenue} strong />
          <DreLine label="(−) CMV (custo dos produtos)" value={-data.cogs} muted />
          <DreLine label="= Margem bruta" value={data.grossMargin} percent={data.grossMarginPercent} divider />
          <DreLine label="(−) Comissões de consignação" value={-data.consignmentCommissions} muted />
          <DreLine label="(−) Taxas de pagamento" value={-data.paymentFees} muted />
          <DreLine label="(−) Despesas operacionais" value={-data.operatingExpenses} muted />
          <DreLine label="= Resultado líquido" value={data.netResult} percent={data.netResultPercent} divider strong
            positive={data.netResult >= 0} />

          {data.expensesByCategory.length > 0 && (
            <div className="pt-4 mt-3 border-t border-charcoal-100/60 dark:border-charcoal-700/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400 mb-2">Despesas por categoria</p>
              {data.expensesByCategory.map((c) => (
                <div key={c.category} className="flex justify-between text-sm py-1">
                  <span className="text-charcoal-600 dark:text-charcoal-300">{c.category}</span>
                  <span className="text-charcoal-700 dark:text-charcoal-200">{BRL.format(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DreLine({ label, value, percent, muted, strong, divider, positive }: {
  label: string; value: number; percent?: number; muted?: boolean; strong?: boolean; divider?: boolean; positive?: boolean;
}) {
  const color = positive === false
    ? 'text-red-500 dark:text-red-400'
    : strong ? 'text-charcoal-800 dark:text-cream-200' : muted ? 'text-charcoal-500 dark:text-charcoal-400' : 'text-charcoal-700 dark:text-charcoal-200';
  return (
    <div className={`flex items-center justify-between py-1.5 ${divider ? 'border-t border-charcoal-100/60 dark:border-charcoal-700/60 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${strong ? 'font-semibold' : ''} ${muted ? 'text-charcoal-500 dark:text-charcoal-400' : 'text-charcoal-700 dark:text-charcoal-200'}`}>{label}</span>
      <span className={`text-sm ${strong ? 'font-semibold' : ''} ${color}`}>
        {BRL.format(value)}{percent != null ? ` (${percent.toFixed(1)}%)` : ''}
      </span>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'red' | 'gold' }) {
  const accentClass = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-500 dark:text-red-400',
    gold: 'text-gold',
  }[accent];
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-charcoal-400 dark:text-charcoal-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="input-field" />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-charcoal-600 dark:text-charcoal-400 mb-1 uppercase tracking-wide">{children}</label>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-charcoal-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-charcoal-100 dark:border-charcoal-700 px-6 py-4">
          <h2 className="text-base font-semibold text-charcoal-800 dark:text-cream-200">{title}</h2>
          <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
