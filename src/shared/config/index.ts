import dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
});

export const config = {
  mode: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  host: "0.0.0.0",

  // RN28: todas as datas de negócio (prazos de vaga, matrícula, consentimento)
  // são interpretadas nesse fuso e gravadas em UTC (`timestamptz`).
  timezone: process.env.APP_TIMEZONE || "America/Campo_Grande",

  // RNF01: piso de 12 aplicado pelo PasswordHasher (não confie só no env).
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),

  // Sessão (RN-A3): 30 min sem uso ou 8 h desde o login.
  sessionIdleMs: Number(process.env.SESSION_IDLE_MS ?? 1_800_000),
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS ?? 28_800_000),

  // RN-A4: 5 falhas seguidas no mesmo e-mail bloqueiam o login por 15 min.
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  loginBlockMs: Number(process.env.LOGIN_BLOCK_MS ?? 900_000),
  touchThrottleMs: Number(process.env.TOUCH_THROTTLE_MS ?? 60_000),

  // Task 05: monta os links dos e-mails (reset, convite, confirmação).
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",

  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "estagia_cg_dev",
  },

  mail: {
    host: process.env.SMTP_HOST || "smtp.mailtrap.io",
    port: Number(process.env.SMTP_PORT) || 2525,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "",
  },

  sentryDsn: process.env.SENTRY_DSN || "",
};
