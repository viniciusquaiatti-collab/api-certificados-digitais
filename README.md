#  NexaSpark

Eu acabei de concluir o curso técnico de Desenvolvimento Backend pelo SENAI e quis ir além do que me ensinaram. Eu usei IA generativa como ferramenta de aceleração — mas cada decisão de arquitetura, cada escolha técnica e cada problema resolvido aqui passou pela minha cabeça antes de passar pelo código.

Eu construí uma plataforma SaaS de certificação digital. Do zero. Em produção.

---

## Por que isso existe

Eu queria um projeto que fosse real — não um CRUD para portfólio. Eu escolhi certificação digital porque envolve criptografia, controle de acesso, geração de documentos, pagamentos futuros e uma necessidade real de mercado. Qualquer instituição que emite certificados em PDF enviado por email está usando uma solução que não garante autenticidade. Eu quis resolver isso.

---

## Stack

Eu não escolhi tecnologia por modismo. Eu escolhi o que faz sentido para o problema.

- **Next.js 16 + React 19** — Eu precisava de SSR para SEO na landing e CSR no dashboard. Next.js resolve os dois sem configuração extra.
- **Node.js + Express** — Eu conheço o ecossistema, a comunidade é enorme e o desempenho para uma API REST é mais que suficiente para o estágio atual.
- **PostgreSQL** — Dados relacionais com integridade transacional. Certificado tem dono, tem emissão, tem verificação — isso é relacional por natureza.
- **JWT com rotação de claims** — Eu precisava carregar estado do usuário entre requisições sem consultar o banco em cada chamada. JWT resolve isso elegantemente quando bem implementado.
- **Google OAuth 2.0** — Reduz fricção no cadastro e elimina responsabilidade de armazenar senhas para quem prefere essa rota.
- **Cloudinary** — Eu precisava de armazenamento de PDFs com URL pública, CDN global e transformações on-the-fly. S3 seria mais barato em escala, mas o overhead de configuração não compensava agora. Cloudinary entrega CDN + storage + URL permanente sem infraestrutura adicional.
- **Supabase** — PostgreSQL gerenciado com RLS nativo. Eu não queria gerenciar instância de banco nesse momento.
- **Railway** — Deploy de backend Node.js com zero configuração de servidor. Eu foco no código, não em DevOps.
- **Vercel** — Frontend Next.js com edge network global. A escolha óbvia quando você usa Next.js.

---

## O que eu construí

Eu prefiro não listar tudo. Mas vou dizer o suficiente para despertar curiosidade.

Eu implementei um sistema onde cada certificado gerado é matematicamente único e publicamente verificável — sem login, sem conta, sem fricção. Qualquer pessoa com o link ou QR Code confirma a autenticidade em tempo real.

Eu construí controle de planos que não dá pra burlar — não é só uma validação no frontend. A restrição existe em camadas no servidor, e eu pensei em cada uma delas.

Eu fiz uma experiência visual que não parece projeto de faculdade. Partículas, animações, dashboard com métricas em tempo real. Porque apresentação importa tanto quanto funcionalidade.

O resto você descobre acessando.

---

## Infra

Eu montei uma arquitetura que separa responsabilidades com clareza:

Frontend na **Vercel** — edge global, zero cold start para o usuário final.

Backend no **Railway** — isolado, escalável horizontalmente quando precisar, com logs estruturados que eu implementei do zero para rastrear cada requisição com ID único.

Banco no **Supabase** — com Row Level Security ativo. Nenhuma query retorna dado de outro usuário, independente de como a requisição chegue.

Arquivos no **Cloudinary** — CDN em mais de 80 países. Um PDF gerado no Brasil abre rápido no Japão.

---
