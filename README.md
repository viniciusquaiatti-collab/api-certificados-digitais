NexaSpark

Plataforma SaaS de certificação digital com verificação pública, autenticação segura, geração automática de PDFs e arquitetura focada em segurança, rastreabilidade e escalabilidade.

O projeto foi desenvolvido como uma aplicação real de produto — não apenas como portfólio acadêmico. A proposta da NexaSpark é permitir que empresas, instituições e profissionais emitam certificados digitais verificáveis através de QR Code e URL pública, com validação criptográfica e infraestrutura cloud.

Preview
Frontend → Next.js + React
Backend → Node.js + Express
Database → PostgreSQL (Supabase)
Storage → Cloudinary
Deploy → Vercel + Railway
Security → JWT + RLS + Rate Limit + Anti-Abuse
Tests → 99 testes automatizados
Funcionalidades
Emissão de certificados
Geração automática de certificados PDF
QR Code incorporado ao documento
Código único de verificação
Hash SHA-256 para integridade
Upload automático para Cloudinary
Persistência segura no PostgreSQL
Verificação pública

Cada certificado possui:

URL pública de validação
QR Code verificável
Status de revogação
Histórico de verificações
Contador de acessos
Proteção anti-enumeração

A verificação não exige login.

Sistema de revogação

A API suporta revogação segura de certificados.

Fluxo implementado:

PATCH /api/certificates/:id/revoke

Características:

revogação idempotente;
auditoria automática;
resposta HTTP 410 Gone para certificados revogados;
rastreamento de responsável pela revogação;
motivo de revogação persistido.
Arquitetura

O backend foi estruturado em camadas separadas para manter responsabilidades isoladas e facilitar manutenção futura.

Routes
  ↓
Middlewares
  ↓
Controllers
  ↓
Models
  ↓
PostgreSQL

Serviços externos:

PDF Service → geração de PDF
Cloudinary Service → upload e CDN
Auth Service → JWT + OAuth
Stack Utilizada
Frontend
Next.js 16
React 19
TypeScript
Tailwind CSS v4
Framer Motion
Three.js
React Three Fiber
Backend
Node.js
Express
PostgreSQL
Supabase
JWT
Passport.js
Google OAuth 2.0
Zod
PDFKit
Cloudinary
Jest
Supertest
Segurança

A segurança foi tratada como parte central do projeto.

Camadas implementadas
Autenticação
JWT com issuer e audience validados
Expiração de token
OAuth 2.0 com Google
bcrypt com salt rounds 12
Proteção da API
Helmet
HPP
CORS com whitelist
Rate limit multicamadas
Sanitização de entrada
Anti-abuse por IP e fingerprint
Banco de dados
Row Level Security (RLS)
Queries isoladas por usuário
security_invoker = true
LGPD
CPF armazenado apenas como SHA-256
CPF mascarado nos logs
Rotas públicas nunca retornam dados sensíveis
Defesa em Profundidade

A aplicação possui múltiplas camadas de proteção:

Cloudflare
  ↓
Global Rate Limit
  ↓
Auth Rate Limit
  ↓
Certificate Rate Limit
  ↓
Plan Limit Middleware
  ↓
Verification Protection
Fluxo de Emissão
Request
  ↓
JWT Validation
  ↓
Rate Limit
  ↓
Plan Validation
  ↓
Zod Validation
  ↓
Database INSERT
  ↓
PDF Generation
  ↓
Cloudinary Upload
  ↓
Audit Log

Decisão arquitetural importante:
o certificado é persistido antes da geração do PDF para evitar arquivos órfãos em caso de falha.

Observabilidade

A API possui sistema próprio de logs estruturados.

Recursos
timestamps ISO;
níveis de severidade;
rastreamento de performance;
PID por processo;
logs de auditoria;
diferenciação entre falha de infraestrutura e erro de aplicação.

Exemplo de classificação de performance:

⚡ <50ms
🟡 <200ms
🟠 <1000ms
🔴 >=1000ms
Testes

Atualmente o projeto possui:

99 testes passando
0 falhando
5 suites

Cobertura atual:

autenticação;
emissão;
verificação;
middlewares;
criptografia;
formatadores;
regras de negócio.

Estrutura:

__tests__/
├── integration/
├── unit/

Ferramentas:

Jest
Supertest
Infraestrutura
Serviço	Plataforma
Frontend	Vercel
Backend	Railway
Banco	Supabase
CDN PDFs	Cloudinary
Proteção DDoS	Cloudflare
Diferenciais Técnicos
Hash determinístico

O sistema gera hashes consistentes para garantir integridade dos certificados ao longo do tempo.

AuditLog desacoplado

Falhas no sistema de auditoria não interrompem operações principais.

Rate limit por usuário

A emissão utiliza userId em vez de IP para evitar bypass por VPN.

Certificados revogados

Certificados revogados retornam:

410 Gone

Isso evita ambiguidades semânticas e melhora rastreabilidade.

Próximos Passos

Roadmap atual do projeto:

assinatura digital avançada;
email transacional;
Stripe para planos pagos;
API pública;
webhooks;
dashboard analítico;
multi-tenant;
templates customizados;
passkeys/WebAuthn;
blockchain hash anchoring.
Aprendizados Durante o Projeto

Este projeto serviu como estudo prático de:

arquitetura em camadas;
autenticação moderna;
segurança em APIs;
observabilidade;
deploy cloud;
integração contínua;
PostgreSQL com RLS;
testes automatizados;
geração de PDFs;
proteção anti-abuse;
design de APIs REST.
Uso de IA no Desenvolvimento

Ferramentas de IA generativa foram utilizadas como suporte para:

debugging;
pesquisa técnica;
refatoração;
aceleração de desenvolvimento.

Todas as decisões arquiteturais, validações, integrações e adaptações foram analisadas manualmente durante o desenvolvimento do projeto.

Status do Projeto
Em desenvolvimento ativo

A NexaSpark continua evoluindo com foco em:

segurança;
escalabilidade;
experiência do usuário;
automação;
confiabilidade da emissão digital.
