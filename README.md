# DKFlow — SaaS Project Management Tool

<div align="center">

**A production-grade project management platform built for modern teams.**

Board • List • Table • Calendar • Timeline • Roadmap • Dashboard

[Live Demo](https://72.61.173.123) · [Admin Panel](https://72.61.173.123:8443)

</div>

---

## ✨ Features

### Core Views
- **Board View** — Drag & drop Kanban with swimlanes (assignee/priority/type)
- **List View** — Grouped task list with inline editing
- **Table View** — Spreadsheet-style with sorting, CSV import/export
- **Calendar View** — Due date based task calendar
- **Timeline View** — Gantt chart with dependency arrows
- **Roadmap View** — Epic-based roadmap with milestones
- **Dashboard** — 12 widget types (burndown, velocity, workload, etc.)
- **Backlog** — Sprint planning with drag-to-sprint
- **Portfolio** — Cross-project overview with health tracking

### Project Management
- **Sprints** — Create, start, complete sprints with velocity tracking
- **Story Points** — Fibonacci estimation (0, 1, 2, 3, 5, 8, 13, 21)
- **Workflow Engine** — Custom statuses with transition rules per project
- **Task Linking** — Blocks, blocked by, duplicates, relates to, clones
- **Recurring Tasks** — Daily, weekly, monthly auto-creation
- **Custom Fields** — Text, number, date, dropdown, checkbox, URL types
- **Labels & Priorities** — Color-coded labels, 5 priority levels
- **File Attachments** — Drag & drop upload with preview
- **Checklists** — Nested checklists within tasks
- **Comments** — Rich text/Markdown with emoji reactions
- **Time Tracking** — Log time, reports grouped by user/task/date
- **Versions/Releases** — Tag tasks to versions, track release progress

### Team & Access
- **Workspaces** — Multi-tenant with isolated data
- **10 Roles** — Owner, Admin, PM, Scrum Master, Product Owner, Developer, Designer, QA, BA, Viewer
- **14 Permissions** — Granular RBAC enforced at API level
- **Teams** — Group members, view workload & performance
- **Invitations** — Email-based invite with role assignment

### Integrations
- **Git Integration** — GitHub, GitLab, Bitbucket webhook receiver
- **Smart Commits** — `fixes DK-1` auto-moves tasks, PR merge completes tasks
- **Slack/Teams** — Webhook notifications for task, comment, sprint events
- **Webhooks** — Custom outgoing webhooks with test button
- **API Keys** — Programmatic access with hashed storage
- **Email-to-Task** — Inbound email endpoint for task creation
- **Public Forms** — External form submissions create tasks

### AI-Powered (Pro)
- **Task Description Generator** — AI writes task descriptions
- **Sprint Planning Assistant** — Smart sprint suggestions
- **Project Summary** — AI-generated project overviews

### Security & Auth
- **2FA** — TOTP with QR code + backup codes
- **JWT Auth** — 1hr access tokens with proactive refresh
- **Password Reset** — Email-based with Redis token storage
- **Rate Limiting** — API rate limiting with express-rate-limit
- **Audit Log** — Full CRUD logging with filterable UI

### User Experience
- **Dark Theme** — Forced dark mode, slate-950 design
- **Mobile Responsive** — Hamburger sidebar, touch-friendly
- **Onboarding Tour** — 9-step guided walkthrough (driver.js)
- **Keyboard Shortcuts** — Power user shortcuts with help dialog
- **Command Palette** — Quick navigation (Cmd+K)
- **Real-time Updates** — Socket.IO live sync
- **PDF Export** — Export views to PDF
- **Empty States** — Helpful empty state illustrations
- **Loading Skeletons** — Smooth loading experience

### Subscription System
- **Free Plan** — 1 project, 3 members, 100 tasks, 5MB files
- **Pro Plan** — Unlimited everything, activated via license key
- **API-level Enforcement** — Limits checked server-side, not just UI
- **License Key Activation** — Generate and redeem keys

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Express.js, tRPC, TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **Cache** | Redis |
| **Real-time** | Socket.IO |
| **Auth** | JWT (HS256) + TOTP 2FA |
| **Monorepo** | Turborepo + pnpm |
| **Process Manager** | PM2 |
| **Reverse Proxy** | Nginx + SSL |

---

## 📁 Project Structure

```
dkflow/
├── apps/
│   ├── api/                  # Express + tRPC backend
│   │   ├── prisma/           # Schema & migrations
│   │   ├── src/
│   │   │   ├── routers/      # 31+ tRPC routers
│   │   │   ├── middleware/    # Auth, RBAC, subscription
│   │   │   ├── services/     # Email, AI, integrations
│   │   │   └── utils/        # Helpers, audit, Redis
│   │   └── package.json
│   └── web/                  # Next.js 15 frontend
│       ├── src/
│       │   ├── app/          # 35+ pages (App Router)
│       │   ├── components/   # 60+ components
│       │   ├── hooks/        # Custom React hooks
│       │   ├── stores/       # Zustand state stores
│       │   └── lib/          # tRPC client, utils
│       └── package.json
├── packages/
│   ├── shared/               # Shared types, schemas, constants
│   └── config/               # ESLint, TypeScript configs
├── scripts/                  # Admin scripts (license key gen)
├── turbo.json
└── pnpm-workspace.yaml
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Redis 7+
- pnpm 9+

### Installation

```bash
# Clone
git clone https://github.com/lokesg/dkflow-.git
cd dkflow-

# Install dependencies
pnpm install

# Setup environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your database URL, JWT secret, SMTP credentials, etc.

# Setup database
cd apps/api
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

# Run development
cd ../..
pnpm dev
```

### Environment Variables (`apps/api/.env`)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/dkflow
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
APP_URL=https://your-domain.com
OPENAI_API_KEY=sk-... (optional, for AI features)
```

### Production Deployment

```bash
# Build
pnpm --filter web build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

---

## 📊 Stats

- **31+** API routers with **100+** procedures
- **35+** pages
- **60+** components
- **50** Prisma models
- **10** role types with **14** permissions each
- **12** dashboard widget types
- **9** project views

---

## 📄 License

Private — All rights reserved.

---

<div align="center">
Built with ❤️ by <a href="https://github.com/lokesg">Lokesh</a>
</div>
