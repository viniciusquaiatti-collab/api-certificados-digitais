# NexaSpark — Documentação Técnica

Plataforma SaaS de certificação digital. Emissão, verificação e revogação de certificados com segurança criptográfica, auditoria completa e infraestrutura em nuvem.

---

## Índice

1. [Arquitetura](#arquitetura)
2. [Stack](#stack)
3. [Autenticação](#autenticação)
4. [Endpoints](#endpoints)
5. [Fluxo de emissão](#fluxo-de-emissão)
6. [Fluxo de verificação](#fluxo-de-verificação)
7. [Fluxo de revogação](#fluxo-de-revogação)
8. [Segurança](#segurança)
9. [Banco de dados](#banco-de-dados)
10. [Observabilidade](#observabilidade)
11. [Testes](#testes)
12. [Infraestrutura](#infraestrutura)

---

## Arquitetura

O backend é estruturado em camadas com responsabilidades isoladas:

```
Routes
  ↓
Middlewares (auth, rate limit, plan limit, validation)
  ↓
Controllers (orquestração)
  ↓
Models (SQL + logging)
  ↓
PostgreSQL (Supabase)

Controllers
  ↓
Services (geração de PDF, upload Cloudinary)
```

**Decisão crítica:** o certificado é persistido no banco antes da geração do PDF. Se o PDF falhar, o certificado existe e pode ser re-gerado. Inverter essa ordem criaria registros órfãos irrecuperáveis.

---

## Stack

| Componente | Tecnologia |
|------------|-----------|
| Runtime | Node.js v24 |
| Framework | Express |
| Banco de dados | PostgreSQL (Supabase, pooler aws-0) |
| Driver | pg + pg-pool |
| Autenticação | JWT (jsonwebtoken) + Google OAuth 2.0 (Passport.js) |
| Hash de senha | bcrypt (12 rounds) |
| Validação | Zod |
| PDF | PDFKit |
| QR Code | qrcode |
| Storage | Cloudinary |
| Segurança | Helmet, CORS, HPP, express-rate-limit |
| Testes | Jest + Supertest |
| Deploy | Railway |

**Frontend:**

| Componente | Tecnologia |
|------------|-----------|
| Framework | Next.js 16.2.4 |
| UI | React 19, TypeScript |
| Estilo | Tailwind CSS v4 |
| Animações | Framer Motion, Three.js |
| Deploy | Vercel |

---

## Autenticação

### JWT

Todos os tokens são assinados com `HS256` e incluem:

```json
{
  "id": 24,
  "email": "usuario@email.com",
  "role": "user",
  "auth_provider": "google",
  "plano": "free",
  "plano_limite": 2,
  "cpf_cadastrado": true,
  "iat": 1779908601,
  "exp": 1780513401,
  "aud": "nexaspark-app",
  "iss": "nexaspark"
}
```

Expiração: **7 dias**. O campo `plano_limite` é propagado no token para que o `planLimitMiddleware` não precise consultar o banco a cada requisição.

### Google OAuth 2.0

Fluxo completo via Passport.js com `session: false` — sem session server-side, apenas JWT.

```
Frontend → GET /api/auth/google
         → redirect accounts.google.com
         → autorização do usuário
         → GET /api/auth/google/callback
         → Passport valida → controller gera JWT
         → redirect FRONTEND_URL/auth/callback?token=xxx
         → frontend captura token, remove da URL via replaceState
```

---

## Endpoints

### Autenticação

| Método | Rota | Proteção | Descrição |
|--------|------|----------|-----------|
| `POST` | `/api/auth/register` | Pública | Registro com email + senha |
| `POST` | `/api/auth/login` | Pública | Login local |
| `GET` | `/api/auth/google` | Pública | Inicia fluxo OAuth Google |
| `GET` | `/api/auth/google/callback` | OAuth | Callback do Google |
| `GET` | `/api/auth/me` | JWT | Valida sessão ativa |
| `GET` | `/api/auth/profile` | JWT | Perfil completo |
| `POST` | `/api/auth/complete-profile` | JWT | Vincula CPF + data de nascimento (usuários Google) |

### Certificados

| Método | Rota | Proteção | Descrição |
|--------|------|----------|-----------|
| `POST` | `/api/certificates` | JWT + Plan Limit | Emite novo certificado |
| `GET` | `/api/certificates` | JWT | Lista certificados do usuário |
| `GET` | `/api/certificates/:id` | JWT | Busca certificado por ID |
| `GET` | `/api/certificates/verify/:codigo` | Pública | Verificação pública por código |
| `PATCH` | `/api/certificates/:id/revoke` | JWT | Revoga certificado |

### Admin

| Método | Rota | Proteção | Descrição |
|--------|------|----------|-----------|
| `GET` | `/api/admin/dashboard` | Admin | Dashboard administrativo |
| `GET` | `/api/admin/logs` | Admin | Logs de auditoria |
| `GET` | `/api/admin/users` | Admin | Lista usuários |
| `GET` | `/api/admin/users/:id/logs` | Admin | Logs de um usuário |

---

## Fluxo de emissão

```
POST /api/certificates

1. authMiddleware          → valida JWT, propaga plano_limite
2. certEmitLimiter         → 10 emissões/min por userId
3. planLimitMiddleware      → verifica limite mensal do plano
4. validateSchema (Zod)    → valida body
5. createCertificate()
   ├── gera codigo_verificacao  (crypto.randomBytes(8) → 16 hex uppercase)
   ├── gera cpf_parcial         (LGPD — 2 últimos dígitos)
   ├── gera hash SHA-256        (nome|cpf|curso|carga|data|codigo)
   ├── INSERT no banco          (antes do PDF — sem órfãos)
   ├── generatePDF()            → PDFKit em memória → QR Code → upload Cloudinary
   ├── UPDATE pdf_path          no banco
   ├── UPDATE hash_preview      no banco (32 chars para DNA visual)
   └── INSERT AuditLog          CERT_CREATED
```

**Body da requisição:**

```json
{
  "nome_participante": "João Silva",
  "cpf": "123.456.789-09",
  "nome_curso": "Node.js Avançado",
  "carga_horaria": 40,
  "data_emissao": "2026-05-27",
  "nome_instrutor": "Maria Souza",
  "descricao": "Descrição opcional"
}
```

**Resposta `201`:**

```json
{
  "success": true,
  "message": "Certificado emitido com sucesso",
  "data": {
    "id": 141,
    "codigo_verificacao": "59FCA7FA82CCC497",
    "nome_participante": "João Silva",
    "nome_curso": "Node.js Avançado",
    "carga_horaria": 40,
    "data_emissao": "2026-05-27",
    "cpf_parcial": "***.***.***-09",
    "hash_preview": "944CC7EB1355753D...",
    "pdf_url": "https://res.cloudinary.com/...",
    "criado_em": "2026-05-27T19:20:46.053Z"
  }
}
```

---

## Fluxo de verificação

```
GET /api/certificates/verify/:codigo

1. verifyLimiter            → 30/min por IP (anti-enumeração)
2. validateSchema
3. verifyCertificate()
   ├── findByVerificationCode()   → retorna revoked_at, revoked_reason
   ├── SE revoked_at → 410 Gone  + AuditLog (alerta fraude)
   ├── Promise.allSettled([
   │     incrementVerification(),      → UPDATE atômico
   │     addVerificationHistory()      → IP + user-agent
   │   ])
   └── resposta pública
```

**Resposta `200` — certificado válido:**

```json
{
  "success": true,
  "data": {
    "valido": true,
    "participante": {
      "nome": "JOÃO SILVA",
      "cpf": "***.***.***-09"
    },
    "curso": {
      "nome": "Node.js Avançado",
      "carga_horaria": 40,
      "data_emissao": "2026-05-27",
      "instrutor": "Maria Souza"
    },
    "verificacao": {
      "codigo": "59FCA7FA82CCC497",
      "hash_preview": "944CC7EB1355753DF8615AA9FDBAE038",
      "total_verificacoes": 3,
      "verificado_em": "2026-05-27T19:20:46.000Z"
    },
    "pdf_url": "https://res.cloudinary.com/..."
  }
}
```

**Resposta `410 Gone` — certificado revogado:**

```json
{
  "success": false,
  "error": "Este certificado foi revogado e não é mais válido",
  "code": "CERT_REVOKED",
  "data": {
    "valido": false,
    "revogado": true,
    "revoked_at": "2026-05-27T01:11:17.865Z",
    "revoked_reason": "Certificado emitido por engano",
    "codigo_verificacao": "59FCA7FA82CCC497"
  }
}
```

**Resposta `404` — não encontrado:**

```json
{
  "success": false,
  "error": "Certificado não encontrado ou código inválido",
  "code": "CERT_NOT_FOUND"
}
```

---

## Fluxo de revogação

```
PATCH /api/certificates/:id/revoke

1. authMiddleware           → JWT obrigatório
2. revokeCertificate()
   ├── valida reason        (max 255 chars)
   ├── Certificate.revoke() → UPDATE WHERE id=$1 AND usuario_id=$2 AND revoked_at IS NULL
   ├── notFound             → 404 (não revela se é de outro usuário)
   ├── alreadyRevoked       → 200 CERT_ALREADY_REVOKED (idempotente)
   └── sucesso              → 200 + AuditLog CERT_REVOKED
```

**Body (opcional):**

```json
{
  "reason": "Certificado emitido por engano"
}
```

**Por que `PATCH` e não `DELETE`?** O recurso não é removido — continua existindo no banco, apenas muda de estado. `PATCH` é semanticamente correto para modificação parcial.

**Por que `410 Gone` e não `404`?** `404` significa que nunca existiu. `410` significa que existiu mas não existe mais — correto para certificados revogados.

**Por que `404` quando outro usuário tenta revogar?** Retornar `403` confirmaria que o certificado existe mas pertence a outra pessoa — vazamento de informação. Com `404`, o solicitante não sabe se o certificado não existe ou se não tem permissão.

**Por que idempotente?** Em sistemas distribuídos, retries são comuns. Se a primeira revogação foi bem-sucedida mas a resposta se perdeu na rede, a segunda chamada retorna `200 CERT_ALREADY_REVOKED` em vez de erro.

---

## Segurança

### Defesa em profundidade — 6 camadas

```
Camada 1 → Cloudflare (DDoS volumétrico)
Camada 2 → globalLimiter (100 req/15min por IP)
Camada 3 → authLimiter (20 req/15min por IP — apenas login/register)
Camada 4 → certEmitLimiter (10 emissões/min por userId)
Camada 5 → planLimitMiddleware (limite mensal do plano)
Camada 6 → verifyLimiter (30 verificações/min por IP)
```

**Rate limit por userId, não por IP.** VPN troca de IP em segundos. Rate limit por `userId` é vinculado à conta — impossível burlar sem comprometer as credenciais.

### LGPD

- CPF nunca armazenado em texto puro — apenas SHA-256 (Art. 46)
- CPF mascarado em todos os logs como `***.***.***-XX`
- Rotas públicas nunca retornam CPF completo — apenas `cpf_parcial`
- `findByVerificationCode()` exclui CPF e hash completo do SELECT

### Anti-abuso no registro

- Verificação de CPF duplicado (hash SHA-256)
- Device fingerprint silencioso
- Contagem de contas por IP nos últimos 7 dias
- Abuse score calculado na entrada — conta bloqueada automaticamente

### Banco de dados

- Row Level Security (RLS) no Supabase
- Queries com `usuario_id` em todos os SELECTs sensíveis — isolamento total entre usuários
- `findById(id, usuario_id)` — um usuário não acessa dados de outro mesmo conhecendo o ID

---

## Banco de dados

### Tabela `certificates`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | `SERIAL PRIMARY KEY` | Identificador interno |
| `usuario_id` | `INTEGER` | FK para `users` |
| `nome_participante` | `VARCHAR` | Nome no certificado |
| `cpf` | `VARCHAR` | CPF completo (retornado apenas em rotas autenticadas do dono) |
| `cpf_parcial` | `VARCHAR` | `***.***.***-XX` para exibição pública |
| `nome_curso` | `VARCHAR` | Nome do curso |
| `carga_horaria` | `INTEGER` | Horas |
| `data_emissao` | `DATE` | Data de emissão |
| `codigo_verificacao` | `VARCHAR(16) UNIQUE` | 16 chars hex uppercase |
| `hash` | `VARCHAR(64)` | SHA-256 completo |
| `hash_preview` | `VARCHAR(64)` | 32 chars uppercase para DNA visual |
| `pdf_path` | `TEXT` | URL Cloudinary |
| `nome_instrutor` | `VARCHAR` | Opcional |
| `descricao` | `TEXT` | Opcional |
| `verificacoes_count` | `INTEGER` | Contador atômico |
| `ultima_verificacao` | `TIMESTAMPTZ` | Timestamp da última verificação |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` = válido, preenchido = revogado |
| `revoked_reason` | `TEXT` | Motivo da revogação |
| `revoked_by` | `INTEGER` | `usuario_id` de quem revogou |
| `criado_em` | `TIMESTAMPTZ` | Timestamp de criação |
| `atualizado_em` | `TIMESTAMPTZ` | Última atualização |

### Hash SHA-256

O hash é gerado a partir do payload normalizado:

```
NOME_PARTICIPANTE|CPF_DIGITOS|NOME_CURSO|CARGA_HORARIA|DATA_EMISSAO|CODIGO_VERIFICACAO
```

Normalização: campos em uppercase, CPF apenas dígitos, espaços colapsados. O mesmo payload sempre gera o mesmo hash — imutabilidade verificável.

### Tabela `audit_logs`

Registro imutável de todas as ações críticas. Nunca é deletado. Falhas na auditoria não interrompem operações principais.

**Ações catalogadas:**

```
REGISTER, LOGIN, LOGOUT, LOGIN_FAILED
LOGIN_GOOGLE, REGISTER_GOOGLE
CERT_CREATED, CERT_VIEWED, CERT_VERIFIED, CERT_REVOKED
CERT_PDF_GENERATED, CERT_DELETED
ADMIN_ACCESS, ADMIN_USER_LIST
RATE_LIMIT_HIT, SECURITY_ALERT
PROFILE_COMPLETED
```

---

## Observabilidade

O sistema possui logger enterprise próprio em todos os módulos.

**Formato por linha:**

```
[ISO timestamp] [PID:XXXXX] [LEVEL:SCOPE] mensagem {payload JSON}
```

**Níveis:**

| Nível | Badge | Uso |
|-------|-------|-----|
| `info` | `ℹ️` | Informativos gerais |
| `success` | `✅` | Operação concluída |
| `warn` | `⚠️` | Situação não crítica |
| `error` | `❌` | Erro de código |
| `conn` | `🔌` | Erro de conectividade com banco |
| `sec` | `🚨` | Alerta de segurança |
| `audit` | `🔏` | Evento de auditoria |
| `perf` | `⏱️` | Telemetria de performance |

**Performance semafórica:**

```
⚡ < 50ms    → índice usado, cache hit
🟡 < 200ms   → query ok
🟠 < 1000ms  → query lenta — verificar EXPLAIN ANALYZE
🔴 ≥ 1000ms  → crítico — indexar urgente
```

**Diferenciação infra × código:**

O `logger.conn()` com badge exclusivo `🔌 DB:CONN` diferencia erro de infraestrutura (banco inacessível) de erro de código. Banco inacessível retorna `503 Service Unavailable`, não `500 Internal Server Error`.

---

## Testes

```
Test Suites: 5 passed, 5 total
Tests:       99 passed, 99 total
```

| Suite | Tipo | Cobertura |
|-------|------|-----------|
| `auth.test.js` | Integração HTTP | Registro, login, JWT, Google OAuth, rotas protegidas |
| `certificates.test.js` | Integração HTTP | Emissão, verificação, listagem, rate limit, plan limit |
| `crypto.test.js` | Unitário | `generateHash()`, `hashCpf()`, `validateCpf()`, `maskCPF()` |
| `formatters.test.js` | Unitário | `formatDateBR()`, `getVerificationUrl()`, bug de timezone |
| `planLimit.test.js` | Unitário | planLimitMiddleware — dentro do limite, bloqueado, ilimitado, banco falhando |

O `AuditLog.create()` nunca lança exceção — falha na auditoria não interrompe operação principal. Os testes cobrem esse comportamento explicitamente.

---

## Infraestrutura

| Serviço | Plataforma | Função |
|---------|-----------|--------|
| Frontend | Vercel | Deploy automático via GitHub |
| Backend | Railway | Deploy automático via GitHub |
| Banco de dados | Supabase | PostgreSQL gerenciado + RLS |
| Storage | Cloudinary | PDFs gerados — CDN automático |
| Proteção | Cloudflare | DDoS, proxy reverso, HSTS |

**Variáveis de ambiente obrigatórias (backend):**

```
DATABASE_URL
JWT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
CLOUDINARY_URL
FRONTEND_URL
ALLOWED_ORIGINS
```

---

## Códigos de erro

| Código | HTTP | Descrição |
|--------|------|-----------|
| `CERT_NOT_FOUND` | 404 | Certificado não encontrado |
| `CERT_REVOKED` | 410 | Certificado revogado |
| `CERT_ALREADY_REVOKED` | 200 | Já estava revogado (idempotente) |
| `PLAN_LIMIT_REACHED` | 403 | Limite mensal do plano atingido |
| `CERT_EMIT_RATE_LIMIT` | 429 | 10 emissões/min excedido |
| `CERT_VERIFY_RATE_LIMIT` | 429 | 30 verificações/min excedido |
| `AUTH_RATE_LIMIT_EXCEEDED` | 429 | 20 tentativas de auth/15min excedido |
| `SERVICE_UNAVAILABLE` | 503 | Banco inacessível |
| `INVALID_CREDENTIALS` | 401 | Email ou senha incorretos |
| `OAUTH_ACCOUNT_NO_PASSWORD` | 401 | Conta Google tentou login local |
| `EMAIL_DUPLICATE` | 409 | Email já cadastrado |
| `CPF_ALREADY_REGISTERED` | 409 | CPF vinculado a outra conta |
| `INVALID_CPF` | 400 | CPF inválido matematicamente |
| `ACCOUNT_BLOCKED` | 403 | Conta suspensa por abuso |
| `ROUTE_NOT_FOUND` | 404 | Rota não existe |

---

## Histórico de versões

| Versão | Descrição |
|--------|-----------|
| v1.0 | Emissão, verificação, autenticação local |
| v2.0 | hash_preview, DNA visual, countThisMonthByUserId, logger enterprise |
| v2.1 | isDbConnErr(), dbConnResponse(), 503 para banco inacessível, planLimitMiddleware ativado |
| v3.0 | Revogação de certificados — PATCH /:id/revoke, 410 Gone, CERT_REVOKED no AuditLog |

---

## Próximos passos

- [ ] Assinatura digital no certificado (canvas + signature_pad)
- [ ] Email transacional (Resend + React Email)
- [ ] Planos pagos (Stripe)
- [ ] API pública com API Keys (B2B)
- [ ] Webhooks
- [ ] Painel analítico
- [ ] Templates customizados de certificado
- [ ] Multi-tenant
- [ ] Ancoragem de hash em blockchain