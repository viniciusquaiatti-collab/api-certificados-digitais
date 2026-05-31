<div align="center">

# ⚡ NexaSpark
### Plataforma de Certificação Digital

**Emita, verifique e gerencie certificados digitais com segurança criptográfica.**

[![Node.js](https://img.shields.io/badge/Node.js-v24-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/Testes-99%20passando-22c55e?style=flat-square)](/)
[![Status](https://img.shields.io/badge/Status-Em%20desenvolvimento%20ativo-f59e0b?style=flat-square)](/)

</div>

---

## O que é

NexaSpark é uma plataforma SaaS de certificação digital. Empresas, escolas e profissionais emitem certificados com PDF gerado automaticamente, QR Code incorporado e página de verificação pública — sem necessidade de login para quem verifica.

Cada certificado tem assinatura SHA-256, URL única e histórico completo de verificações.

---

## Funcionalidades

- **Emissão** — PDF gerado automaticamente com QR Code e código único de verificação
- **Verificação pública** — qualquer pessoa verifica sem precisar de conta
- **Revogação** — emissor pode cancelar certificados; verificação retorna `410 Gone`
- **Autenticação** — login local (email + senha) e Google OAuth 2.0
- **Auditoria** — cada ação crítica é registrada com IP, timestamp e metadados
- **Proteção anti-abuso** — rate limit por userId, device fingerprint e IP tracking

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| Backend | Node.js, Express |
| Banco de dados | PostgreSQL via Supabase |
| Autenticação | JWT + Google OAuth 2.0 (Passport.js) |
| PDF | PDFKit + QRCode |
| Storage | Cloudinary |
| Testes | Jest + Supertest |
| Deploy | Vercel (frontend) + Railway (backend) |

---

## Decisões técnicas que valem explicar

### Por que o certificado é persistido antes do PDF ser gerado?

Implementei a gravação no banco **antes** de chamar o serviço de geração de PDF. Se o Cloudinary falhar ou o PDFKit lançar um erro no meio da renderização, o certificado ainda existe no banco e pode ser re-gerado. Inverter essa ordem criaria registros órfãos — um PDF no Cloudinary sem nenhum certificado correspondente no banco, sem forma de rastrear ou recuperar.

```
INSERT INTO certificates → generatePDF() → upload Cloudinary → UPDATE pdf_path
       ↑
   salvo aqui primeiro
```

### Por que rate limit por userId e não por IP?

Rate limit por IP é trivialmente burlável com uma VPN — troca de IP em segundos. Implementei o `certEmitLimiter` usando o `userId` extraído do JWT como chave:

```js
keyGenerator: (req) => {
  return req.user?.id
    ? `user_${req.user.id}`       // ← chave vinculada à conta
    : `ip_${ipKeyGenerator(req)}` // ← fallback para IPv6 normalizado
}
```

Isso significa que o limite de 10 emissões/minuto é por conta, não por endereço de rede. Impossível burlar sem comprometer as próprias credenciais.

### Por que 410 Gone para certificados revogados?

Quando um certificado é revogado, a rota pública de verificação retorna `410 Gone` — não `404`. A diferença é semântica e importa:

- `404 Not Found` → o recurso nunca existiu
- `410 Gone` → o recurso existiu mas não existe mais

Certificados revogados existiram. Usar `410` permite que o frontend diferencie "código inválido" de "certificado cancelado" e exiba mensagens corretas para o usuário que está tentando verificar.

### Por que CPF armazenado como SHA-256?

LGPD Art. 46 exige proteção adequada de dados pessoais sensíveis. O CPF nunca é armazenado em texto puro — apenas seu hash SHA-256. Isso significa que é possível verificar se um CPF já está cadastrado (comparando hashes), mas é computacionalmente inviável recuperar o CPF original a partir do hash.

```js
// CPF jamais aparece em texto puro nos logs
clone.cpf = `***.***.***-${digits.slice(-2)}`;
```

### Por que o AuditLog nunca lança exceção?

Implementei o `AuditLog.create()` com swallow de erros intencional — se a gravação de auditoria falhar (banco instável, timeout), a operação principal do usuário não é interrompida. Um certificado não pode deixar de ser emitido porque o log de auditoria falhou. A auditoria é importante, mas não pode ser um ponto único de falha.

### Por que 503 e não 500 quando o banco está inacessível?

`500 Internal Server Error` significa erro no código do servidor. `503 Service Unavailable` significa que uma dependência externa está indisponível. Quando o Supabase está inacessível, o problema não é no código — é na infraestrutura. Implementei detecção de erros de conectividade (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`, `57P01`) que retornam `503` com hint de diagnóstico nos logs:

```
🔌 DB:CONN  Banco inacessível — retornando 503
  hint_2: "Supabase migrou pooler: aws-1 → aws-0. Troque o host."
```

---

## Segurança

### 6 camadas de proteção em profundidade

```
Cloudflare          → DDoS volumétrico (externo)
globalLimiter       → 100 req/15min por IP
authLimiter         → 20 req/15min por IP (apenas login e registro)
certEmitLimiter     → 10 emissões/min por userId
planLimitMiddleware → limite mensal do plano
verifyLimiter       → 30 verificações/min por IP (anti-enumeração)
```

Cada camada captura um tipo diferente de abuso. Nenhuma camada sozinha é suficiente.

### Outras proteções

- JWT com `issuer: nexaspark` e `audience: nexaspark-app` — tokens de outros sistemas são rejeitados
- bcrypt com 12 rounds
- CPF armazenado apenas como SHA-256 (LGPD Art. 46)
- Row Level Security no Supabase
- Helmet, CORS com whitelist, HPP
- Anti-abuso no registro: verificação de CPF duplicado, device fingerprint, contagem de contas por IP

---

## Testes

```
Test Suites: 5 passed, 5 total
Tests:       99 passed, 99 total
```

| Suite | Tipo | O que cobre |
|-------|------|-------------|
| `auth.test.js` | Integração | Registro, login, JWT, Google OAuth, rotas protegidas |
| `certificates.test.js` | Integração | Emissão, verificação, listagem, rate limit, plan limit |
| `crypto.test.js` | Unitário | `generateHash()`, `hashCpf()`, `validateCpf()`, `maskCPF()` |
| `formatters.test.js` | Unitário | `formatDateBR()`, `getVerificationUrl()`, bug de timezone |
| `planLimit.test.js` | Unitário | planLimitMiddleware — dentro do limite, bloqueado, banco falhando |

---

## Rodando localmente

### Pré-requisitos

- Node.js v18+
- Conta no [Supabase](https://supabase.com) com banco PostgreSQL criado
- Conta no [Cloudinary](https://cloudinary.com) para armazenamento dos PDFs
- Credenciais do [Google OAuth 2.0](https://console.cloud.google.com) configuradas

### Backend

```bash
cd backend
npm install
```

```bash
npm run dev
```

O boot completo mostra todas as rotas registradas e confirma a conexão com o banco:

```
✅ NexaSpark API ONLINE → http://localhost:8080
🛣️  POST  /api/auth/register        [PUBLIC]
🛣️  POST  /api/auth/login           [PUBLIC]
🛣️  GET   /api/auth/google          [OAUTH]
🛣️  POST  /api/certificates         [PROTECTED]
🛣️  GET   /api/certificates/verify/:codigo  [RATE LIMITED]
🛣️  PATCH /api/certificates/:id/revoke     [PROTECTED]
✅ PostgreSQL conectado ✅
```


```
Test Suites: 5 passed, 5 total
Tests:       99 passed, 99 total
Time:        ~8s
```

---

## Observabilidade

A API tem sistema de logs estruturado com performance semafórica em todas as operações:

```
⚡ < 50ms    → índice usado, cache hit
🟡 < 200ms   → query ok
🟠 < 1000ms  → query lenta
🔴 ≥ 1000ms  → crítico — investigar imediatamente
```

Exemplo real de log de emissão:

```
🎓  EMITINDO CERTIFICADO — User #71
✅ [CTRL:CREATE:DB] Certificate.create() → 220ms 🟡
🖨️  generatePDF() completo → 8742ms 🔴 LENTO
✅ [CLOUDINARY:UPLOAD] SUCCESS — 1324 KB
✅ [CTRL:CREATE:DB] hash_preview salvo no banco
📤 [CTRL:RES] 201 Certificado criado com sucesso
```

---

## Próximos passos

- [ ] Assinatura digital no certificado (canvas + signature_pad)
- [ ] Email transacional (Resend + React Email)
- [ ] Planos pagos (Stripe)
- [ ] API pública com API Keys (B2B)
- [ ] Painel analítico
- [ ] Webhooks
- [ ] Templates customizados de certificado

---

<div align="center">
  <sub>Desenvolvido por Vinícius Quaiatti · nexaspark.com.br</sub>
</div>
