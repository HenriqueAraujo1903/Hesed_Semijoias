# Contexto do Projeto — HESED Semijoias (V2)

> Documento atualizado em 13/08/2026 após migração completa de stack.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Java 21 + Spring Boot 3.3.2 + Maven |
| Frontend | React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 |
| Banco | PostgreSQL 16 (local, banco `hesed_db`) |
| Auth | Spring Security + JWT (jjwt 0.12.6) |
| Upload | Armazenamento local (`./uploads/`) |
| CSV Import | Apache Commons CSV |

---

## Como Rodar

### Backend (porta 8080)
```bash
cd backend
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
mvn spring-boot:run
```

### Frontend (porta 5173)
```bash
cd frontend
npm run dev
```

### Credenciais (seed automático no primeiro boot)
- **Admin:** `admin@hesed.com` / `admin123`
- **Operador:** `operator@hesed.com` / `operador123`

---

## Estrutura de Diretórios

```
KIRO/
├── backend/
│   └── src/main/java/com/hesed/
│       ├── config/         SecurityConfig, JwtService, JwtAuthFilter, WebConfig, DataInitializer
│       ├── controllers/    AuthController, ProductController, AdminProductController, ConsigneeController
│       ├── dto/            LoginRequest/Response, ProductRequest/Response, ConsigneeRequest/Response
│       ├── models/         User, Product, Consignee, Consignment, ConsignmentItem, Sale, SaleItem
│       ├── repositories/   JPA interfaces
│       ├── services/       AuthService, ProductService, ConsigneeService, FileStorageService, CsvImportService
│       └── utils/
├── frontend/
│   └── src/
│       ├── components/     ProtectedRoute
│       ├── contexts/       AuthContext
│       ├── layouts/        DashboardLayout (Sidebar + Outlet)
│       ├── pages/          LoginPage, DashboardPage, ProductsPage, AdminProductsPage, ConsigneesPage, CatalogoPage
│       ├── services/       api.ts (axios + interceptors)
│       └── utils/
└── CONTEXTO_PROJETO.md
```

---

## Endpoints da API

| Endpoint | Método | Auth | Descrição |
|---|---|---|---|
| `/api/auth/login` | POST | Público | Login, retorna JWT |
| `/api/products` | GET | Público | Lista produtos (com filtros) |
| `/api/products/catalog` | GET | Público | Lista para catálogo |
| `/api/admin/products` | POST | ADMIN | Criar produto |
| `/api/admin/products/{id}` | PUT | ADMIN | Atualizar produto |
| `/api/admin/products/{id}` | DELETE | ADMIN | Excluir produto |
| `/api/admin/products/import` | POST | ADMIN | Importar CSV (Google Sheets) |
| `/api/admin/products/upload` | POST | ADMIN | Upload de imagem |
| `/api/consignees` | GET | AUTH | Lista revendedoras |
| `/api/consignees` | POST | AUTH | Criar revendedora |
| `/api/consignees/{id}` | PUT | AUTH | Atualizar |
| `/api/consignees/{id}` | DELETE | AUTH | Excluir |

---

## Páginas do Frontend

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | Público | Formulário de login |
| `/catalogo` | Público | Catálogo + envio WhatsApp |
| `/dashboard` | AUTH | Placeholder de métricas |
| `/produtos` | AUTH | Tabela de estoque (leitura) |
| `/revendedoras` | AUTH | CRUD de revendedoras |
| `/admin/produtos` | ADMIN | CRUD completo de produtos |

---

## Módulos Pendentes (Backlog)

| Prioridade | Módulo | Status |
|---|---|---|
| P1 | Consignações (abrir lotes, retorno, pagamento) | Schema pronto, backend/frontend pendente |
| P2 | Vendas Diretas (checkout interno) | Schema pronto, pendente |
| P2 | Dashboard Real (queries + gráficos) | Placeholder existe |
| P3 | Relatórios / Financeiro (PDF/CSV export) | Não iniciado |
| — | Migrar upload para AWS S3 | Não iniciado |
