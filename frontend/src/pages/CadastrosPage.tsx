import { useState } from 'react';
import SuppliersPage from './SuppliersPage';
import CustomersPage from './CustomersPage';
import CategoriesPage from './CategoriesPage';

type Tab = 'clientes' | 'fornecedores' | 'categorias';

const TABS: { key: Tab; label: string }[] = [
  { key: 'clientes', label: 'Clientes' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'categorias', label: 'Categorias' },
];

export default function CadastrosPage() {
  const [tab, setTab] = useState<Tab>('clientes');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Cadastros</h1>
        <p className="mt-1 text-sm text-stone-500">Clientes, fornecedores e categorias da loja.</p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-2 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-gold text-gold'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clientes' && <CustomersPage />}
      {tab === 'fornecedores' && <SuppliersPage />}
      {tab === 'categorias' && <CategoriesPage />}
    </div>
  );
}
