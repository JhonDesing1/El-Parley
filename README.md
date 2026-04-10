# ⚡ ApuestaValue

> **La plataforma de Value Betting #1 para Colombia y LATAM.**
> Comparador de cuotas, detección matemática de value bets y parlays de alta probabilidad para Betplay, Wplay, Codere, Rivalo y más.

## 🎯 Propuesta

A diferencia de tipsters de Telegram, **ApuestaValue no adivina**: calcula la probabilidad implícita de cada cuota y la compara contra un modelo Poisson ajustado por xG. Solo marca como *value bet* selecciones con **edge matemático ≥ 3%**.

## 💰 Modelo de ingresos

1. **Afiliados** — CPA/RevShare con Betplay, Wplay, Codere, Rivalo (entre $25 y $300 USD por FTD en LATAM).
2. **Premium** — $4.99 USD / $19.900 COP al mes. Parlays exclusivos, ROI tracking, alertas push, API.
3. **SEO orgánico** — previas y análisis auto-generados diarios (>500 artículos/mes).

## 🧱 Stack

- **Next.js 15** (App Router, RSC, Server Actions) + TypeScript strict
- **Tailwind CSS** + Shadcn/ui + Lucide
- **Supabase** (Postgres + Auth + Realtime + Edge Functions)
- **TanStack Query** v5 + Zod
- **Stripe** (global) + **PayU** (Colombia)
- **API-Football** (RapidAPI) + The Odds API + NewsAPI
- **OneSignal** (push)
- **Vercel** (hosting + cron)

## 📂 Docs

- [`STRUCTURE.md`](./STRUCTURE.md) — árbol de carpetas
- [`DEPLOY.md`](./DEPLOY.md) — deploy paso a paso
- [`.env.example`](./.env.example) — todas las variables

## ⚖️ Legal y juego responsable

Plataforma informativa. No acepta apuestas ni custodia fondos. Redirige a operadores licenciados por **Coljuegos**. Incluye banner permanente con LÍNEA 106 Bogotá y [ludopatia.org.co](https://ludopatia.org.co).
