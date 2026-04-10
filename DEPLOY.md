# 🚀 Deploy ApuestaValue — Paso a Paso

> Tiempo estimado: ~30 min si tienes las cuentas listas.

---

## 0. Cuentas necesarias

| Servicio | Para qué | Plan inicial |
|---|---|---|
| [Vercel](https://vercel.com) | Hosting Next.js + Cron | Hobby (gratis) |
| [Supabase](https://supabase.com) | DB + Auth + Edge Fns | Free (500MB) |
| [API-Football](https://www.api-football.com/) (RapidAPI) | Fixtures, odds, stats | Free 100 req/día |
| [The Odds API](https://the-odds-api.com/) | Backup de cuotas | Free 500/mes |
| [NewsAPI](https://newsapi.org/) | Noticias | Free 100/día |
| [Stripe](https://dashboard.stripe.com/) | Pagos USD | Pago por uso |
| [PayU LATAM](https://developers.payulatam.com/) | Pagos COP | Pago por uso |
| [OneSignal](https://onesignal.com/) | Push | Free hasta 10k |
| Programas afiliados | Betplay, Wplay, Codere, Rivalo | Aplicar individualmente |

---

## 1. Clona y prepara local

```bash
git clone <tu-repo> apuestavalue && cd apuestavalue
cp .env.example .env.local
npm install
```

---

## 2. Supabase

### 2.1 Crear proyecto

1. Ve a https://supabase.com/dashboard → **New project**
2. Región recomendada: **South America (São Paulo)** para latencia LATAM
3. Guarda el `Project Ref` y la `Database password`

### 2.2 Conectar CLI y aplicar migraciones

```bash
npx supabase login
npx supabase link --project-ref <TU_PROJECT_REF>
npx supabase db push
```

Esto ejecuta los 3 archivos en `supabase/migrations/` en orden y crea:
- 17 tablas
- RLS policies
- Triggers (auto-perfil al registrarse, implied_prob, updated_at)
- RPC `get_matches_today`
- Seeds de bookmakers y ligas principales

### 2.3 Generar tipos TypeScript

```bash
npm run db:types
```

Esto crea `src/types/database.ts` con tipos generados desde tu schema.

### 2.4 Configurar Auth

En el dashboard de Supabase → **Authentication → Providers**:

- **Email**: activa "Magic Link"
- **Google**:
  1. Ve a [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
  2. Crea OAuth client (Web). Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
  3. Pega `Client ID` y `Client Secret` en Supabase

En **Auth → URL Configuration**:
- Site URL: `https://tu-dominio.com`
- Redirect URLs: añade `https://tu-dominio.com/auth/callback`

### 2.5 Desplegar Edge Functions

```bash
npx supabase functions deploy detect-value-bets
npx supabase functions deploy generate-parlays
```

Configura los secrets:

```bash
npx supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
```

### 2.6 Agendar Edge Functions con pg_cron

En el SQL Editor del dashboard:

```sql
select cron.schedule(
  'detect-value-bets',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/detect-value-bets',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
  $$
);

select cron.schedule(
  'generate-parlays',
  '0 12 * * *',  -- 07:00 COT
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/generate-parlays',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  );
  $$
);
```

---

## 3. Stripe

### 3.1 Crear productos

Dashboard → Products → **+ Add product**:
- **ApuestaValue Premium Mensual** — recurring $4.99/mes
- **ApuestaValue Premium Anual** — recurring $49/año

Copia los `price_id` (empiezan con `price_...`) en `.env.local`.

### 3.2 Webhook

Dashboard → Developers → Webhooks → **Add endpoint**:
- URL: `https://tu-dominio.com/api/webhooks/stripe`
- Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Copia el **Signing secret** (`whsec_...`) a `STRIPE_WEBHOOK_SECRET`.

### 3.3 Test local con Stripe CLI

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 4. Vercel

### 4.1 Importar repo

1. Ve a https://vercel.com/new
2. Importa tu repositorio
3. **Framework Preset**: Next.js (auto-detectado)

### 4.2 Variables de entorno

Settings → Environment Variables. Pega TODAS las del `.env.example` con sus valores reales.

⚠️ **Críticas**: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` deben estar marcadas como *encrypted*.

### 4.3 Cron jobs

Ya están definidos en `vercel.json`:
- `/api/cron/sync-odds` cada 10 min
- `/api/cron/sync-fixtures` cada 6h
- `/api/cron/generate-blog` diario 12:00 UTC

Vercel los activa automáticamente al deploy. Verifica en **Settings → Cron Jobs**.

### 4.4 Deploy

```bash
git push origin main
```

O manualmente con `vercel --prod`.

---

## 5. Configurar API-Football

1. Suscríbete en https://www.api-football.com/
2. Copia tu key desde el dashboard a `API_FOOTBALL_KEY`
3. **Recomendado**: Plan Pro ($25/mes) para 75k req/día — esencial si tienes >10 ligas activas

---

## 6. Programas de afiliados

Aplicar individualmente. En LATAM las redes principales son:

| Casa | Programa | Comisión típica |
|---|---|---|
| Betplay | [Betplay Partners](https://betplay.com.co/affiliates) | $150 USD CPA |
| Wplay | [Wplay Affiliates](https://wplay.co/affiliates) | $120 USD CPA |
| Codere | [MyAffiliates Codere](https://codereaffiliates.com) | 30% revshare |
| Rivalo | [Rivalo Partners](https://rivalo.com/partners) | $100 CPA |

Una vez aprobado, copia tu **tracker tag** a las variables `NEXT_PUBLIC_*_AFF`.

---

## 7. Cargar primeros datos

Ejecuta manualmente los crons una vez para poblar:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/sync-fixtures
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/sync-odds
```

Y dispara la edge function:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<PROJECT_REF>.supabase.co/functions/v1/detect-value-bets
```

---

## 8. Checklist post-deploy

- [ ] Login con Google funciona
- [ ] El home muestra partidos del día
- [ ] `/partido/[id]` carga con cuotas
- [ ] El click en "Apostar" registra en `affiliate_clicks` y redirige
- [ ] El webhook de Stripe pasa a `active` la suscripción tras checkout test
- [ ] Cron jobs ejecutándose en Vercel (panel Cron Jobs)
- [ ] Edge function `detect-value-bets` corriendo cada 15min
- [ ] Banner de juego responsable visible en footer
- [ ] PWA instalable (manifest + iconos en `/public/icons/`)
- [ ] Sitemap accesible en `/sitemap.xml`

---

## 9. Optimizaciones recomendadas (semana 2)

1. **Preact compat** para reducir bundle JS
2. **ISR** en `/partido/[id]` con `revalidate = 60`
3. **Imágenes** servir logos de equipos desde Cloudflare R2 con cache largo
4. **Postgres index** adicional en `(kickoff, status)` si el home se vuelve lento
5. **Rate limiting** en `/api/track/affiliate` con Upstash Redis
6. **Sentry** para error tracking
7. **PostHog** para funnel de conversión free → premium

---

## 10. Costos estimados (mes 1)

| Concepto | Costo |
|---|---|
| Vercel Hobby | $0 |
| Supabase Free | $0 |
| API-Football Free | $0 (suficiente para 5 ligas) |
| Dominio .com | ~$12/año |
| **Total** | **~$1/mes** |

A los ~5k usuarios activos pasa a:
| Concepto | Costo |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| API-Football Pro | $25 |
| OneSignal Growth | $9 |
| **Total** | **~$80/mes** |

Con 50 conversiones premium/mes a $5 USD = $250 USD ingresos directos + afiliados.
ROI rentable desde el primer mes si tienes tráfico orgánico decente.
