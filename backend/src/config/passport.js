// src/config/passport.js
// ============================================================
// 🔐 NexaSpark — Passport.js | Google OAuth 2.0 Strategy
//
// Responsabilidade:
//   Configurar a estratégia Google OAuth 2.0 do Passport.
//   Ao receber o perfil do Google, faz UPSERT no PostgreSQL:
//   - Se o email já existe → vincula google_id e atualiza avatar
//   - Se é novo → cria usuário com auth_provider = 'google'
//
// ⚠️  DECISÃO ARQUITETURAL:
//   Usamos session: false em todas as rotas — o estado de auth
//   é mantido via JWT, não via express-session.
//   O express-session é necessário apenas para o Passport
//   funcionar durante o fluxo de callback (é destruído após).
//
// ⚠️  INTEGRAÇÃO COM PROJETO EXISTENTE:
//   - Usa pool do db.js diretamente (sem ORM) — igual ao resto
//   - Segue o padrão de logger ANSI já estabelecido no projeto
//   - Usa SERIAL id (integer) — conforme migration existente
//   - Nunca loga accessToken/refreshToken (segurança)
// ============================================================

const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool }       = require('../database/db');

// ============================================================
// 🎨 LOGGER — Mesmo padrão ANSI do projeto (app.js / authController.js)
// Centralizado aqui para não depender de módulo externo.
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
  white:   (s) => `\x1b[37m${s}\x1b[0m`,
};

const logger = {
  info:    (msg, data) => console.log(   c.cyan(`ℹ️  [Passport]`),         msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (msg, data) => console.log(   c.green(`✅ [Passport]`),        msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (msg, data) => console.warn(  c.yellow(`⚠️  [Passport]`),       msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (msg, data) => console.error( c.red(`❌ [Passport]`),          msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  db:      (msg, data) => console.log(   c.cyan(`🗄️  [Passport:DB]`),      msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (label, ms) => console.log(   c.magenta(`⏱️  [Passport:PERF]`), `${label} — ${c.bold(ms + 'ms')}`),
  sec:     (msg, data) => console.warn(  c.red(`🚨 [Passport:SEC]`),      msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  event:   (msg, data) => console.log(   c.blue(`🎯 [Passport:EVENT]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  flow:    (step, msg, data) => console.log(
    c.magenta(`🔀 [Passport:FLOW]`),
    c.bold(`[STEP ${step}]`),
    c.white(msg),
    data !== undefined ? c.gray(JSON.stringify(data)) : ''
  ),
  sep:     () => console.log(c.gray('─'.repeat(60))),
  bigsep:  () => console.log(c.gray('═'.repeat(60))),
};

// ============================================================
// 🚦 BANNER DE INICIALIZAÇÃO DO MÓDULO
// Exibido uma vez quando o app.js carrega este arquivo.
// ============================================================
logger.bigsep();
console.log(c.bold(c.green('  🔐 [Passport] Módulo OAuth 2.0 inicializando...')));
console.log(c.gray(`  Timestamp: ${new Date().toISOString()}`));
logger.bigsep();

// ============================================================
// 🔍 VALIDAÇÃO DE VARIÁVEIS DE AMBIENTE
//
// ⚠️  FAIL FAST — detecta problemas na inicialização,
//     não em runtime. Assim o erro aparece nos logs do Railway
//     imediatamente após o deploy, não quando o usuário tenta logar.
// ============================================================
logger.flow(1, 'Validando variáveis de ambiente...');

const ENV_REQUIRED = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const ENV_MISSING  = ENV_REQUIRED.filter((key) => !process.env[key]);

if (ENV_MISSING.length > 0) {
  logger.error('Variáveis de ambiente ausentes!', { missing: ENV_MISSING });
  logger.warn('OAuth Google estará INATIVO até que as variáveis sejam configuradas.');
  logger.warn('Configure no Railway → Variables e no .env local');
} else {
  logger.success('Todas as variáveis de ambiente OAuth presentes ✅', {
    GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID?.substring(0, 12) + '...',
    GOOGLE_CLIENT_SECRET: '[REDACTED]',
    GOOGLE_CALLBACK_URL:  process.env.GOOGLE_CALLBACK_URL,
  });
}

// ============================================================
// 🔐 GOOGLE STRATEGY — Configuração e Verify Callback
// ============================================================
logger.flow(2, 'Registrando GoogleStrategy no Passport...');

passport.use(
  new GoogleStrategy(
    // ── Opções da Strategy ────────────────────────────────────
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
      // ⚠️  scope aqui é redundante com o das rotas mas garante
      //     que a strategy sempre saiba o que foi pedido
      scope: ['profile', 'email'],
    },

    // ── Verify Callback ───────────────────────────────────────
    // Chamado pelo Passport APÓS o Google confirmar o usuário.
    // Responsabilidade: encontrar ou criar o usuário local
    // e retorná-lo via done(null, user).
    //
    // Parâmetros:
    //   accessToken  — token de acesso às APIs Google (não usamos)
    //   refreshToken — token de renovação (não usamos)
    //   profile      — perfil público do Google
    //   done         — callback: done(err, user)
    // ─────────────────────────────────────────────────────────
    async (accessToken, refreshToken, profile, done) => {
      const t0        = Date.now();
      const sessionId = `oauth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      logger.sep();
      logger.bigsep();
      console.log(c.bold(c.green(`  🔐 [Passport] VERIFY CALLBACK INICIADO`)));
      console.log(c.gray(`  Session: ${sessionId} | ${new Date().toISOString()}`));
      logger.bigsep();

      // ── STEP 1: Extração e sanitização do perfil Google ──────
      logger.flow(1, 'Extraindo dados do perfil Google...', { sessionId });

      const googleId = profile.id;
      const email    = profile.emails?.[0]?.value?.trim().toLowerCase() || null;
      const name     = profile.displayName
                    || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim()
                    || 'Usuário Google';
      const avatar   = profile.photos?.[0]?.value || null;

      // Log detalhado do perfil recebido (sem dados sensíveis)
      console.log(c.cyan(`ℹ️  [Passport:PROFILE]`), c.gray(JSON.stringify({
        sessionId,
        googleId,
        email,
        name,
        hasAvatar:       !!avatar,
        emailsCount:     profile.emails?.length ?? 0,
        photosCount:     profile.photos?.length ?? 0,
        profileProvider: profile.provider,
        // ⚠️  SEGURANÇA: accessToken e refreshToken NUNCA logados
        hasAccessToken:  !!accessToken,
        hasRefreshToken: !!refreshToken,
      })));

      // ── STEP 2: Validações de segurança ──────────────────────
      logger.flow(2, 'Validando dados do perfil...', { sessionId });

      if (!googleId) {
        logger.sec('Google não retornou ID do perfil — autenticação abortada', { sessionId });
        console.error(c.red(`❌ [Passport:VALIDATION] googleId ausente — profile.id = ${profile.id}`));
        return done(new Error('ID do Google não disponível no perfil'), null);
      }

      if (!email) {
        logger.sec('Google não retornou email — autenticação abortada', {
          sessionId,
          googleId,
          emailsRaw: profile.emails,
        });
        console.error(c.red(`❌ [Passport:VALIDATION] email ausente — profile.emails = ${JSON.stringify(profile.emails)}`));
        return done(
          new Error('Email não disponível. Verifique as permissões da sua conta Google.'),
          null
        );
      }

      // Valida formato mínimo do email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        logger.sec('Email retornado pelo Google tem formato inválido', { sessionId, email });
        return done(new Error(`Email com formato inválido: ${email}`), null);
      }

      logger.success('Validação do perfil OK', {
        sessionId,
        googleId: googleId.substring(0, 8) + '...',
        email,
        name,
      });

      // ── STEP 3: UPSERT no PostgreSQL ──────────────────────────
      // Ordem de busca:
      //   1. google_id  → já usou OAuth antes (caso mais comum)
      //   2. email      → tem conta local, vamos vincular o Google
      //   3. nenhum     → usuário completamente novo
      // ─────────────────────────────────────────────────────────
      logger.flow(3, 'Iniciando UPSERT no PostgreSQL...', { sessionId, email });

      try {

        // ════════════════════════════════════════════════════════
        // 📍 BUSCA 1: Por google_id (retorno mais comum)
        // ════════════════════════════════════════════════════════
        logger.db('QUERY 1/3 — SELECT WHERE google_id', { sessionId, googleId });
        const t1 = Date.now();

        const byGoogleId = await pool.query(
          // ⚠️  SELECT explícito — nunca SELECT * em auth
          //     Evita vazar senha_hash acidentalmente
          `SELECT id, email, nome, avatar, auth_provider, criado_em
           FROM   users
           WHERE  google_id = $1
           LIMIT  1`,
          [googleId]
        );

        const q1Ms = Date.now() - t1;
        logger.perf('QUERY 1 — SELECT by google_id', q1Ms);
        console.log(c.cyan(`ℹ️  [Passport:DB]`), `QUERY 1 resultado:`, c.gray(JSON.stringify({
          sessionId,
          rowCount: byGoogleId.rowCount,
          found:    byGoogleId.rows.length > 0,
          queryMs:  q1Ms,
        })));

        // ── CASO 1: Usuário já usou OAuth antes ───────────────
        if (byGoogleId.rows.length > 0) {
          const user = byGoogleId.rows[0];

          logger.flow(4, 'CASO 1: Usuário existente via google_id', {
            sessionId,
            userId:   user.id,
            email:    user.email,
            provider: user.auth_provider,
          });

          // Verifica se avatar mudou — foto do Google muda com o tempo
          const avatarChanged = avatar && avatar !== user.avatar;

          console.log(c.cyan(`ℹ️  [Passport:AVATAR]`), c.gray(JSON.stringify({
            sessionId,
            userId:       user.id,
            avatarChanged,
            oldAvatar:    user.avatar ? user.avatar.substring(0, 40) + '...' : null,
            newAvatar:    avatar      ? avatar.substring(0, 40) + '...'      : null,
          })));

          if (avatarChanged) {
            logger.db('Atualizando avatar do usuário...', { sessionId, userId: user.id });
            const tAvatar = Date.now();

            await pool.query(
              `UPDATE users
               SET    avatar        = $1,
                      atualizado_em = NOW()
               WHERE  id = $2`,
              [avatar, user.id]
            );

            logger.perf('UPDATE avatar', Date.now() - tAvatar);
            logger.success('Avatar atualizado com sucesso', { sessionId, userId: user.id });
            user.avatar = avatar; // atualiza o objeto em memória também
          } else {
            logger.info('Avatar não mudou — UPDATE desnecessário', { sessionId, userId: user.id });
          }

          logger.perf(`Fluxo completo — CASO 1 (existente)`, Date.now() - t0);
          logger.success('══ VERIFY CALLBACK CONCLUÍDO — CASO 1 ══', {
            sessionId,
            userId:   user.id,
            email:    user.email,
            provider: user.auth_provider,
          });
          logger.sep();
          return done(null, user);
        }

        // ════════════════════════════════════════════════════════
        // 📍 BUSCA 2: Por email (conta local existente)
        // ════════════════════════════════════════════════════════
        logger.db('QUERY 2/3 — SELECT WHERE email', { sessionId, email });
        const t2 = Date.now();

        const byEmail = await pool.query(
          `SELECT id, email, nome, avatar, auth_provider, criado_em
           FROM   users
           WHERE  email = $1
           LIMIT  1`,
          [email]
        );

        const q2Ms = Date.now() - t2;
        logger.perf('QUERY 2 — SELECT by email', q2Ms);
        console.log(c.cyan(`ℹ️  [Passport:DB]`), `QUERY 2 resultado:`, c.gray(JSON.stringify({
          sessionId,
          rowCount:      byEmail.rowCount,
          found:         byEmail.rows.length > 0,
          existingProv:  byEmail.rows[0]?.auth_provider || null,
          queryMs:       q2Ms,
        })));

        // ── CASO 2: Email existe, vincula google_id ────────────
        if (byEmail.rows.length > 0) {
          const existingUser = byEmail.rows[0];

          logger.flow(4, 'CASO 2: Email existente — vinculando conta Google', {
            sessionId,
            userId:       existingUser.id,
            email:        existingUser.email,
            prevProvider: existingUser.auth_provider,
            newProvider:  'google',
          });

          // ⚠️  AUDITORIA INLINE: logar quando uma conta local
          //     recebe um google_id pela primeira vez é crítico
          //     para rastreabilidade e detecção de account takeover
          if (existingUser.auth_provider === 'local') {
            logger.event('Conta local sendo vinculada ao Google pela primeira vez', {
              sessionId,
              userId: existingUser.id,
              email:  existingUser.email,
            });
          }

          logger.db('QUERY 3/3 — UPDATE vincular google_id', { sessionId, userId: existingUser.id });
          const t3 = Date.now();

          const updated = await pool.query(
            `UPDATE users
             SET    google_id     = $1,
                    avatar        = COALESCE($2, avatar),
                    auth_provider = 'google',
                    atualizado_em = NOW()
             WHERE  id = $3
             RETURNING id, email, nome, avatar, auth_provider, criado_em`,
            [googleId, avatar, existingUser.id]
          );

          const q3Ms = Date.now() - t3;
          logger.perf('QUERY 3 — UPDATE vincular google_id', q3Ms);
          console.log(c.cyan(`ℹ️  [Passport:DB]`), `QUERY 3 resultado:`, c.gray(JSON.stringify({
            sessionId,
            rowCount:    updated.rowCount,
            userId:      updated.rows[0]?.id,
            newProvider: updated.rows[0]?.auth_provider,
            queryMs:     q3Ms,
          })));

          if (updated.rowCount === 0) {
            // Não deveria acontecer — loga como anomalia
            logger.warn('UPDATE retornou 0 rows — anomalia detectada', {
              sessionId,
              userId: existingUser.id,
            });
          }

          logger.perf(`Fluxo completo — CASO 2 (vinculação)`, Date.now() - t0);
          logger.success('══ VERIFY CALLBACK CONCLUÍDO — CASO 2 ══', {
            sessionId,
            userId:      updated.rows[0].id,
            email:       updated.rows[0].email,
            linkedGoogle: true,
          });
          logger.sep();
          return done(null, updated.rows[0]);
        }

        // ════════════════════════════════════════════════════════
        // 📍 INSERT: Usuário completamente novo
        // ════════════════════════════════════════════════════════
        logger.flow(4, 'CASO 3: Usuário novo — inserindo no banco', {
          sessionId,
          email,
          name,
          hasAvatar: !!avatar,
        });

        logger.db('QUERY 3/3 — INSERT novo usuário OAuth', { sessionId, email });
        const t4 = Date.now();

        const newUser = await pool.query(
          // ⚠️  senha_hash = NULL intencionalmente:
          //     Usuários OAuth não possuem senha local.
          //     Para definir senha, devem usar "esqueci minha senha".
          //     O authController.login vai rejeitar tentativas de
          //     login por senha (bcrypt.compare com NULL vai falhar).
          `INSERT INTO users
             (email, nome, google_id, avatar, auth_provider, senha_hash, criado_em)
           VALUES
             ($1,    $2,   $3,        $4,     'google',      NULL,       NOW())
           RETURNING id, email, nome, avatar, auth_provider, criado_em`,
          [email, name, googleId, avatar]
        );

        const q4Ms = Date.now() - t4;
        logger.perf('QUERY 3 — INSERT novo usuário', q4Ms);
        console.log(c.cyan(`ℹ️  [Passport:DB]`), `INSERT resultado:`, c.gray(JSON.stringify({
          sessionId,
          rowCount: newUser.rowCount,
          userId:   newUser.rows[0]?.id,
          email:    newUser.rows[0]?.email,
          queryMs:  q4Ms,
        })));

        logger.perf(`Fluxo completo — CASO 3 (novo usuário)`, Date.now() - t0);
        logger.success('══ VERIFY CALLBACK CONCLUÍDO — CASO 3 ══', {
          sessionId,
          userId:      newUser.rows[0].id,
          email:       newUser.rows[0].email,
          isNewUser:   true,
          auth_provider: 'google',
        });
        logger.sep();
        return done(null, newUser.rows[0]);

      } catch (err) {

        // ── Tratamento de race condition (INSERT duplicado) ────
        // Acontece se dois callbacks chegam ao mesmo tempo
        // com o mesmo email (raro mas possível)
        if (err.code === '23505') {
          logger.warn('Race condition — violação de UNIQUE constraint', {
            sessionId,
            email,
            pgCode: err.code,
            detail: err.detail,
          });
          console.warn(c.yellow(`⚠️  [Passport:RACE]`), 'Tentando retry após race condition...', c.gray(JSON.stringify({ sessionId, email })));

          try {
            const tRetry = Date.now();
            const retry  = await pool.query(
              `SELECT id, email, nome, avatar, auth_provider, criado_em
               FROM   users
               WHERE  email = $1
               LIMIT  1`,
              [email]
            );
            logger.perf('RETRY query', Date.now() - tRetry);

            if (retry.rows.length > 0) {
              logger.success('Retry bem-sucedido após race condition', {
                sessionId,
                userId: retry.rows[0].id,
              });
              return done(null, retry.rows[0]);
            }

            logger.error('Retry não encontrou usuário após race condition', { sessionId, email });
          } catch (retryErr) {
            logger.error('Erro no retry após race condition', {
              sessionId,
              message: retryErr.message,
              code:    retryErr.code,
            });
          }
        }

        // ── Erro genérico de banco ─────────────────────────────
        logger.sec('Erro crítico no verify callback', {
          sessionId,
          message: err.message,
          code:    err.code,
          email,
        });
        console.error(c.red(`❌ [Passport:ERROR]`), 'Stack trace completo:\n' + err.stack);
        logger.perf(`Fluxo com ERRO`, Date.now() - t0);
        logger.sep();
        return done(err, null);
      }
    }
  )
);

logger.flow(3, 'GoogleStrategy registrada com sucesso ✅');

// ============================================================
// 🔒 SERIALIZE USER
//
// ⚠️  Chamado pelo Passport para salvar o usuário na session.
//     Mesmo usando session: false nas rotas, o Passport exige
//     que serialize/deserialize estejam definidos.
//     Serializamos apenas o id — mínimo de dados na session.
// ============================================================
passport.serializeUser((user, done) => {
  console.log(
    c.cyan(`ℹ️  [Passport:SERIALIZE]`),
    `Serializando usuário para session`,
    c.gray(JSON.stringify({ userId: user.id, email: user.email }))
  );
  done(null, user.id);
});

// ============================================================
// 🔓 DESERIALIZE USER
//
// ⚠️  Chamado pelo Passport para reconstruir o usuário a partir
//     do id salvo na session. Necessário para o fluxo de callback.
//     Com session: false nas rotas, raramente é chamado —
//     mas deve estar definido para o Passport não lançar erro.
// ============================================================
passport.deserializeUser(async (id, done) => {
  console.log(
    c.cyan(`ℹ️  [Passport:DESERIALIZE]`),
    `Deserializando usuário da session`,
    c.gray(JSON.stringify({ userId: id }))
  );

  const tDeserialize = Date.now();

  try {
    const result = await pool.query(
      // ⚠️  Exclui senha_hash — não é necessário após login
      `SELECT id, email, nome, avatar, auth_provider, criado_em
       FROM   users
       WHERE  id = $1
       LIMIT  1`,
      [id]
    );

    logger.perf('deserializeUser query', Date.now() - tDeserialize);

    if (!result.rows[0]) {
      logger.warn('deserializeUser — usuário não encontrado no banco', { userId: id });
      console.warn(c.yellow(`⚠️  [Passport:DESERIALIZE]`), `User id=${id} não existe mais no banco`);
      return done(null, false); // false = session inválida, mas não é erro
    }

    console.log(
      c.green(`✅ [Passport:DESERIALIZE]`),
      `Usuário restaurado da session`,
      c.gray(JSON.stringify({ userId: result.rows[0].id, email: result.rows[0].email }))
    );

    done(null, result.rows[0]);

  } catch (err) {
    logger.error('Erro em deserializeUser', {
      message: err.message,
      code:    err.code,
      userId:  id,
    });
    console.error(c.red(`❌ [Passport:DESERIALIZE]`), 'Stack:\n' + err.stack);
    done(err, null);
  }
});

// ============================================================
// ✅ MÓDULO PRONTO
// ============================================================
logger.bigsep();
console.log(c.bold(c.green('  ✅ [Passport] Módulo OAuth 2.0 pronto!')));
console.log(c.gray(`  Strategy: Google OAuth 2.0`));
console.log(c.gray(`  Callback: ${process.env.GOOGLE_CALLBACK_URL || 'NÃO DEFINIDO ⚠️'}`));
console.log(c.gray(`  Session:  false (JWT-based auth)`));
logger.bigsep();

module.exports = passport;