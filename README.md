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

## Segurança

- JWT com `issuer` e `audience` validados, expiração de 7 dias
- bcrypt com 12 rounds
- Rate limiting em 6 camadas (Cloudflare → global → auth → emissão → plano → verificação)
- Rate limit por `userId` — não burlável por VPN
- CPF armazenado apenas como SHA-256 (LGPD Art. 46)
- Row Level Security no Supabase
- Helmet, CORS com whitelist, HPP

---

## Testes

```
Test Suites: 5 passed
Tests:       99 passed
```

Cobertura: autenticação, emissão, verificação, middlewares, criptografia, formatadores e regras de negócio.

---

## Rodando localmente

```bash
# Backend
cd backend
cp .env.example .env   # preencha as variáveis
npm install
npm run dev            # porta 8080

# Frontend
cd web
npm install
npm run dev            # porta 3000
```
---

## Próximos passos

- [ ] Assinatura digital no certificado (canvas + signature_pad)
- [ ] Email transacional (Resend + React Email)
- [ ] Planos pagos (Stripe)
- [ ] API pública com API Keys (B2B)
- [ ] Painel analítico
- [ ] Webhooks
- [ ] Templates customizados

---

<div align="center">
  <sub>Desenvolvido por Vinícius Quaiatti · nexaspark.com.br</sub>
</div>
