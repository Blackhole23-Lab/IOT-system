# Work Plan: Cybersecurity Education Platform (Flask-based CTF)

## Context

Build a Flask-based web platform for cybersecurity education with CTF-style challenges, targeting 50-150 initial users with a clear scaling path to 300-500 users. The platform will deploy via Docker Compose on a single VPS (Hetzner/DigitalOcean/Vultr) with a migration path to Kubernetes for production scaling.

**Design Philosophy:**
- MVP-first with strong baseline security
- Lightweight, maintainable architecture
- Real-world patterns from CTFd and PicoCTF
- Docker Compose for development and initial deployment
- Clear Kubernetes migration path

## Work Objectives

1. Establish complete technology stack with version specifications and justifications
2. Design Docker Compose deployment architecture for single-VPS hosting
3. Define MVP feature set with clear acceptance criteria
4. Implement Phase 1 security hardening with specific libraries and configurations
5. Document next-step actions for post-MVP scaling

## Guardrails

### Must Have
- Flask 3.x backend with production-grade WSGI server (Gunicorn)
- PostgreSQL database (not SQLite - required for concurrent users)
- Redis for session management and caching
- JWT-based authentication with refresh token rotation
- Role-based access control (RBAC): admin, instructor, student
- Docker Compose configuration with health checks and restart policies
- HTTPS/TLS termination (Caddy or Traefik reverse proxy)
- Rate limiting on authentication and API endpoints
- Input validation and sanitization on all user inputs
- SQL injection protection via SQLAlchemy ORM
- XSS protection via Content Security Policy headers
- CSRF protection via Flask-WTF
- Secrets management via environment variables (not hardcoded)
- Database backup strategy (automated daily backups)
- Structured logging (JSON format for log aggregation)
- Official documentation citations for all major dependencies

### Must NOT Have
- No custom authentication crypto (use proven libraries)
- No SQLite in production (concurrency issues at 50+ users)
- No plaintext secrets in Docker Compose files
- No direct database access from frontend
- No user-uploaded executable code without sandboxing
- No session data in cookies (use server-side sessions)
- No premature Kubernetes deployment (Docker Compose first)

## Task Flow

### Phase 1: Core Technology Stack Definition
**Objective:** Document complete stack with versions, justifications, and official documentation links.

**Acceptance Criteria:**
- Technology stack document includes:
  - Backend framework (Flask 3.x) with extensions
  - Database (PostgreSQL 16.x) with connection pooling
  - Cache layer (Redis 7.x) for sessions and leaderboard
  - Frontend framework decision (React 18.x or Vue 3.x)
  - Authentication library (Flask-JWT-Extended 4.x)
  - ORM (SQLAlchemy 2.x with Alembic migrations)
  - WSGI server (Gunicorn with gevent workers)
  - Reverse proxy (Caddy 2.x for automatic HTTPS)
  - Testing framework (pytest with coverage)
- Each technology includes:
  - Version specification with rationale
  - Link to official documentation
  - Real-world usage example (CTFd, PicoCTF, or similar)
  - Security considerations

**Implementation Notes:**
- Reference CTFd's stack: https://github.com/CTFd/CTFd (Flask + SQLAlchemy + Redis)
- Reference PicoCTF platform architecture patterns
- Justify PostgreSQL over MySQL (better JSON support, CTFd uses it)
- Justify Redis over Memcached (persistence, pub/sub for future features)

---

### Phase 2: Docker Compose Architecture
**Objective:** Design production-ready Docker Compose configuration for single-VPS deployment.

**Acceptance Criteria:**
- Docker Compose file (`docker-compose.yml`) defines:
  - Flask application service (Gunicorn with 4 workers)
  - PostgreSQL service with persistent volume
  - Redis service with persistent volume (AOF enabled)
  - Caddy reverse proxy with automatic HTTPS
  - Health check endpoints for all services
  - Restart policies (restart: unless-stopped)
  - Resource limits (memory, CPU)
  - Network isolation (internal network for DB/Redis)
- Separate `docker-compose.override.yml` for development
- `.env.example` file with all required environment variables
- Volume mount strategy:
  - PostgreSQL data: named volume
  - Redis data: named volume
  - Application logs: bind mount to host
  - Caddy certificates: named volume
- Backup strategy documented:
  - Daily PostgreSQL dumps via cron
  - Backup retention policy (30 days)
  - Restore procedure documented

**Implementation Notes:**
- VPS sizing recommendation: 4 vCPU, 8GB RAM, 80GB SSD (Hetzner CPX31 or DigitalOcean equivalent)
- Caddy Caddyfile for automatic HTTPS with Let's Encrypt
- PostgreSQL connection pooling: SQLAlchemy pool_size=20, max_overflow=10
- Redis maxmemory policy: allkeys-lru with 2GB limit

---

### Phase 3: MVP Feature Specification
**Objective:** Define minimum viable feature set with clear acceptance criteria.

**Acceptance Criteria:**
- Feature checklist includes:

**Authentication & Authorization:**
- User registration with email verification
- Login with JWT access token (15min expiry) + refresh token (7 day expiry)
- Password reset flow via email
- Role-based access: admin, instructor, student
- Session management via Redis (server-side)

**Challenge Management:**
- Admin/instructor can create challenges with:
  - Title, description, category, difficulty, points
  - Flag format validation (regex pattern)
  - File attachments (stored in object storage or filesystem)
  - Hints (optional, with point deduction)
- Challenge categories: Web, Crypto, Reverse Engineering, Forensics, Pwn, Misc
- Challenge visibility control (draft, published, archived)

**Progress Tracking & Scoring:**
- User dashboard showing:
  - Challenges attempted/solved
  - Current score and rank
  - Solve timestamps
- Global leaderboard (cached in Redis, updated on solve)
- Challenge solve history (who solved what, when)
- First blood bonus (extra points for first solver)

**Admin Dashboard:**
- User management (view, edit roles, disable accounts)
- Challenge management (CRUD operations)
- Platform statistics:
  - Total users, active users (last 7 days)
  - Total challenges, solve rate per challenge
  - Top solvers
- Audit log (user actions, admin actions)

**Security Baseline:**
- Rate limiting: 5 login attempts per minute per IP
- Input validation on all forms (Flask-WTF with validators)
- SQL injection protection (SQLAlchemy ORM, no raw queries)
- XSS protection (Jinja2 autoescaping + CSP headers)
- CSRF protection (Flask-WTF CSRF tokens)
- Secure password hashing (bcrypt with cost factor 12)
- HTTPS enforcement (Caddy redirect HTTP → HTTPS)

**Implementation Notes:**
- Email service: integrate with SendGrid or Mailgun (SMTP fallback for dev)
- File upload limits: 10MB per file, whitelist extensions
- Flag format: `FLAG{...}` with regex validation
- Leaderboard caching: Redis sorted set, TTL 60 seconds

---

### Phase 4: Security Hardening (Phase 1)
**Objective:** Implement baseline security controls with specific libraries and configurations.

**Acceptance Criteria:**
- Security controls implemented:

**Authentication Security:**
- Library: `Flask-JWT-Extended` 4.6+
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Refresh token rotation on use (invalidate old token)
- Token blacklist via Redis (store revoked tokens)
- Password policy: min 12 chars, complexity requirements
- Password hashing: `bcrypt` with cost factor 12

**Input Validation:**
- Library: `Flask-WTF` 1.2+ with `WTForms` validators
- Validate all form inputs (length, type, format)
- Sanitize HTML inputs: `bleach` library with whitelist
- File upload validation: extension whitelist, MIME type check, virus scan (ClamAV optional)

**HTTP Security Headers:**
- Library: `Flask-Talisman` 1.1+
- Headers configured:
  - `Content-Security-Policy`: restrict script sources
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security`: HSTS with 1 year max-age
  - `Referrer-Policy: strict-origin-when-cross-origin`

**Rate Limiting:**
- Library: `Flask-Limiter` 3.5+
- Limits configured:
  - Login: 5 attempts per minute per IP
  - Registration: 3 attempts per hour per IP
  - Flag submission: 10 attempts per minute per user
  - API endpoints: 100 requests per minute per user

**Secrets Management:**
- All secrets in environment variables (`.env` file, not committed)
- Required secrets:
  - `SECRET_KEY`: Flask session signing (generate via `secrets.token_hex(32)`)
  - `JWT_SECRET_KEY`: JWT signing (separate from Flask secret)
  - `DATABASE_URL`: PostgreSQL connection string
  - `REDIS_URL`: Redis connection string
  - `MAIL_API_KEY`: Email service API key
- Docker secrets for production (Docker Compose secrets or external secrets manager)

**Logging & Monitoring:**
- Library: `python-json-logger` for structured logging
- Log levels: INFO for application events, WARNING for security events, ERROR for failures
- Log fields: timestamp, level, user_id, ip_address, endpoint, message
- Log rotation: daily rotation, 30-day retention
- Security events logged:
  - Failed login attempts
  - Password resets
  - Role changes
  - Challenge flag submissions (correct/incorrect)
  - Admin actions

**Database Security:**
- PostgreSQL user with limited privileges (no SUPERUSER)
- Connection via SSL/TLS (require in production)
- Prepared statements via SQLAlchemy (no raw SQL)
- Database backups encrypted at rest

**Implementation Notes:**
- Reference OWASP Top 10 2021: https://owasp.org/Top10/
- Reference Flask security best practices: https://flask.palletsprojects.com/en/3.0.x/security/
- Reference CTFd security model: https://github.com/CTFd/CTFd/blob/master/SECURITY.md

---

### Phase 5: Kubernetes Migration Path Documentation
**Objective:** Document clear migration path from Docker Compose to Kubernetes.

**Acceptance Criteria:**
- Migration guide includes:

**When to Migrate:**
- Triggers for migration:
  - User count exceeds 300 concurrent users
  - Single VPS resource exhaustion (CPU/memory)
  - Need for zero-downtime deployments
  - Geographic distribution requirements

**Kubernetes Architecture:**
- Deployment manifests for:
  - Flask application (Deployment with 3+ replicas)
  - PostgreSQL (StatefulSet or managed service like AWS RDS)
  - Redis (StatefulSet or managed service like AWS ElastiCache)
  - Ingress controller (nginx-ingress or Traefik)
- ConfigMaps for application configuration
- Secrets for sensitive data
- Persistent Volume Claims for stateful services
- Horizontal Pod Autoscaler for Flask application
- Resource requests and limits defined

**Migration Steps:**
1. Export PostgreSQL data from Docker Compose
2. Set up Kubernetes cluster (managed service recommended)
3. Deploy PostgreSQL StatefulSet or migrate to managed DB
4. Deploy Redis StatefulSet or migrate to managed cache
5. Deploy Flask application with rolling update strategy
6. Configure Ingress with TLS certificates
7. Update DNS to point to Kubernetes Ingress
8. Monitor and validate
9. Decommission Docker Compose VPS

**Managed Service Recommendations:**
- Database: AWS RDS PostgreSQL, DigitalOcean Managed PostgreSQL, or Aiven
- Cache: AWS ElastiCache Redis, DigitalOcean Managed Redis, or Aiven
- Kubernetes: AWS EKS, DigitalOcean Kubernetes, or Linode Kubernetes Engine
- Object Storage: AWS S3, DigitalOcean Spaces, or Backblaze B2 (for file uploads)

**Cost Estimation:**
- Docker Compose (single VPS): $20-40/month
- Kubernetes (managed): $100-200/month (3-node cluster + managed DB/Redis)
- Break-even point: ~250-300 concurrent users

**Implementation Notes:**
- Helm chart template for easier Kubernetes deployment
- CI/CD pipeline for automated deployments (GitHub Actions or GitLab CI)
- Monitoring stack: Prometheus + Grafana (optional for Kubernetes)

---

### Phase 6: Next-Step Actions (Post-MVP)
**Objective:** Document prioritized roadmap for post-MVP enhancements.

**Acceptance Criteria:**
- Roadmap document includes:

**Phase 2 Features (3-6 months post-MVP):**
- Team-based challenges (multi-user collaboration)
- Challenge hints system with point deduction
- Writeup submission and sharing
- Email notifications (challenge releases, announcements)
- Challenge tagging and advanced filtering
- User profile customization
- Social features (follow users, challenge comments)

**Phase 3 Features (6-12 months post-MVP):**
- Dynamic challenge infrastructure (Docker-based challenge instances)
- Jeopardy-style CTF mode (timed competitions)
- Attack-defense CTF mode
- Integration with external CTF platforms (CTFtime API)
- Advanced analytics (solve time distribution, difficulty calibration)
- Gamification (badges, achievements, streaks)
- API for third-party integrations

**Operational Enhancements:**
- Monitoring and alerting (Prometheus + Grafana + Alertmanager)
- Centralized logging (ELK stack or Loki)
- Automated testing (unit tests, integration tests, E2E tests)
- CI/CD pipeline (automated deployments on merge to main)
- Disaster recovery plan (backup validation, restore testing)
- Performance optimization (database query optimization, caching strategy)
- Security audit (penetration testing, code review)

**Scaling Enhancements:**
- CDN for static assets (Cloudflare or AWS CloudFront)
- Object storage for file uploads (S3-compatible)
- Read replicas for PostgreSQL (if read-heavy workload)
- Redis Cluster for high availability
- Multi-region deployment (if global user base)

**Implementation Notes:**
- Prioritize based on user feedback and usage metrics
- Re-evaluate technology choices as platform scales
- Budget for security audits and penetration testing

---

## Success Criteria

**The plan is complete when:**
1. Technology stack is fully specified with versions and documentation links
2. Docker Compose architecture is production-ready for 50-150 users
3. MVP features are clearly defined with acceptance criteria
4. Security hardening (Phase 1) is implemented with specific libraries
5. Kubernetes migration path is documented with cost estimates
6. Post-MVP roadmap is prioritized and actionable

**Verification:**
- All technology choices cite official documentation
- Docker Compose configuration passes `docker-compose config` validation
- Security controls map to OWASP Top 10 mitigations
- Migration path includes cost-benefit analysis
- Roadmap is prioritized by user value and technical dependencies

---

## References

**Official Documentation:**
- Flask: https://flask.palletsprojects.com/en/3.0.x/
- SQLAlchemy: https://docs.sqlalchemy.org/en/20/
- PostgreSQL: https://www.postgresql.org/docs/16/
- Redis: https://redis.io/docs/
- Docker Compose: https://docs.docker.com/compose/
- Caddy: https://caddyserver.com/docs/
- Flask-JWT-Extended: https://flask-jwt-extended.readthedocs.io/
- Flask-Limiter: https://flask-limiter.readthedocs.io/
- OWASP Top 10: https://owasp.org/Top10/

**Real-World Examples:**
- CTFd: https://github.com/CTFd/CTFd (Flask-based CTF platform)
- PicoCTF: https://github.com/picoCTF/picoCTF (Educational CTF platform)
- OWASP Juice Shop: https://github.com/juice-shop/juice-shop (Security training platform)

**Security Resources:**
- Flask Security: https://flask.palletsprojects.com/en/3.0.x/security/
- OWASP Cheat Sheets: https://cheatsheetseries.owasp.org/
- CTFd Security Model: https://github.com/CTFd/CTFd/blob/master/SECURITY.md

---

## Estimated Effort

**Total Effort:** 6-8 weeks for MVP (single full-time developer)

**Breakdown:**
- Phase 1 (Stack Definition): 1 week
- Phase 2 (Docker Compose Setup): 1 week
- Phase 3 (MVP Features): 3-4 weeks
  - Authentication: 1 week
  - Challenge Management: 1 week
  - Progress Tracking: 1 week
  - Admin Dashboard: 1 week
- Phase 4 (Security Hardening): 1 week
- Phase 5 (K8s Migration Docs): 3 days
- Phase 6 (Roadmap): 2 days

**Assumptions:**
- Developer has Flask and Docker experience
- No major scope changes during development
- Third-party services (email, monitoring) are pre-configured
- Design/UI work is handled separately or uses pre-built templates

---

## Notes

**Frontend Technology Decision:**
The plan intentionally leaves frontend framework choice flexible. Recommended options:
1. **React 18.x** - Most popular, large ecosystem, good for complex UIs
2. **Vue 3.x** - Easier learning curve, good for smaller teams
3. **Jinja2 templates + HTMX** - Simplest option, server-side rendering, minimal JavaScript

**Recommendation:** Start with Jinja2 + HTMX for MVP (faster development), migrate to React/Vue if UI complexity grows.

**Database Schema (High-Level):**
- `users` (id, email, username, password_hash, role, created_at)
- `challenges` (id, title, description, category, difficulty, points, flag, created_by, created_at)
- `solves` (id, user_id, challenge_id, solved_at)
- `submissions` (id, user_id, challenge_id, flag_attempt, correct, submitted_at)
- `audit_logs` (id, user_id, action, details, ip_address, timestamp)

**File Storage Strategy:**
- MVP: Local filesystem with volume mount
- Post-MVP: S3-compatible object storage (MinIO self-hosted or AWS S3)

**Email Service:**
- Development: SMTP with Mailhog (local testing)
- Production: SendGrid or Mailgun (transactional email service)

---

**Plan saved to:** `/home/ubuntu/test-system/.omc/plans/cybersecurity-education-platform.md`
