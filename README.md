# VoltFlow

An engineering specification and B2B procurement platform for residential electrical construction.

VoltFlow replaces inaccurate, manual electrical estimates with deterministic Bills of Materials (BOMs) and connects homeowners and contractors with verified wholesale dealers for competitive, real-time bidding.

## The Engine

VoltFlow is not a static price estimator. It is a deterministic calculation engine that outputs actionable engineering documents:

*   **Commercial BOM Translation:** Converts raw room layouts and appliance loads into exact wire gauges, conduit runs, and commercial trade packaging (e.g., rounding 234m of required wire into three 90m coils with calculated surplus).
*   **Distribution Board (DB) Mapper:** Algorithmically designs the main MCB panel.
    *   **Phase Balancing:** Uses a greedy LPT (Longest Processing Time) algorithm to distribute heavy loads evenly across Red, Yellow, and Blue phases to prevent neutral wire burnout.
    *   **Fire-Guard Enforcement:** Strictly enforces safety ceilings, clamping breaker ratings to wire ampacity limits (e.g., forcing a 10A ceiling on 1.5mm² lighting circuits) rather than allowing standard electrician over-spec'ing.
*   **Commodity Volatility Protection:** Bids include explicit `validUntil` deadlines and `wireGrade` designations (FR / FRLS / ZHFR) to protect dealers from copper spot-price movements on the MCX.

## Tech Stack

*   **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
*   **Database:** PostgreSQL (Supabase) + Prisma ORM
*   **Authentication:** Auth.js / NextAuth (Role-based: Homeowner, Dealer, Admin)
*   **Styling:** Tailwind CSS v4 (built with a dense, industrial B2B "drawing sheet" aesthetic)
*   **Transactional Email:** Resend

## Local Setup

**1. Clone and install dependencies:**

```bash
git clone https://github.com/Adhi-opp/VoltFlow.git
cd VoltFlow
npm install
```

**2. Environment Variables:**

Create a `.env` file at the root — not `.env.local`. The Prisma CLI only reads `.env`, so `migrate` and `db seed` will not find the connection strings otherwise. See `.env.example` for the annotated template.

```env
# Database
DATABASE_URL="postgres://[user]:[password]@[host]:6543/postgres" # Transaction pooler
DIRECT_URL="postgres://[user]:[password]@[host]:5432/postgres"   # Session pooler for migrations

# Auth — must match the origin the app is served from
AUTH_SECRET="your_generated_secret"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# Email Operations — optional locally; without a key, notifications no-op and are logged
RESEND_API_KEY="your_resend_key"
ADMIN_EMAIL="admin@voltflow.in"
EMAIL_FROM="notifications@voltflow.in"

# Used to build absolute links inside outgoing emails
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**3. Database Provisioning:**

Run the migrations and seed the database with baseline copper rates and test accounts (Admin, Dealer, Homeowner).

```bash
npx prisma migrate deploy
npx prisma db seed
```

**4. Run the Development Server:**

```bash
npm run dev
```

Navigate to `http://localhost:3000`.

## Architecture Notes

*   **Pure Calculations:** The core electrical logic (`calculateBOM` and `boardEngine`) runs independently of the database layer, ensuring deterministic and fully testable outputs.
*   **Server Actions:** Data mutation and state transitions (RFQ submission, dealer quoting, quote acceptance) are handled exclusively via Next.js Server Actions.
*   **Server-Side Recomputation:** The calculator is public and unauthenticated. Saved projects are recomputed from the submitted layout at current rates rather than trusting any BOM or total supplied by the client.
*   **Tests:** `npm test` runs the calculation specs. `.e2e/` holds an HTTP-level harness that exercises auth, server actions and rendered pages against a running server; see `.e2e/README.md`.
