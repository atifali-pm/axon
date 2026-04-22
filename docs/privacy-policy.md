# Axon Privacy Policy

*Effective: TODO set on publish.*

Axon ("we", "us", "the service") is an AI agent platform for businesses. This policy describes what data we collect, how we use it, and what choices you have. It is written to satisfy Apple App Store, Google Play Store, GDPR, and CCPA disclosure requirements.

## 1. Who the policy covers

- **End users** of the Axon web and mobile apps: individuals who create an Axon account and use it under their organization's workspace.
- **Organization owners**: the person (or company) responsible for the Axon workspace, who is the data controller for their members' activity.

## 2. What we collect

### Information you provide

- **Account**: email, name, hashed password, organization name.
- **Content**: documents you upload (PDFs, DOCX, plain text), chat messages you send, and the assistant's replies.
- **Billing**: Stripe handles payment details. We store only a customer ID and subscription status; full card data never touches our servers.

### Information collected automatically

- **Usage**: API request timestamps, request duration, error rate, chat message counts, document chunk counts (for plan enforcement).
- **Device**: mobile push tokens, device name, platform (iOS / Android), app version.
- **Infra telemetry**: container logs, request-response latency histograms. No request bodies are retained.

### Information from third parties

- **OAuth providers** (when enabled): name, email, avatar from GitHub or Google.
- **LLM providers** (Groq, Google Gemini, OpenRouter, Anthropic, OpenAI): prompt text + completions when your agent run uses them. See section 5 for the LLM routing.

## 3. How we use your data

- To provide the service (authentication, chat, document retrieval, billing).
- To generate AI responses (the user's prompt and retrieved document chunks are sent to the selected LLM provider).
- To operate the business (usage analytics, billing reconciliation, abuse detection).
- To improve the service (aggregate metrics and anonymised error reports; no training on your content unless explicitly opted-in).

**We do not sell your data.** Ever.

## 4. Where your data lives

- **Primary storage**: a self-hosted Postgres database on Oracle Cloud (Frankfurt region for EU customers, Phoenix for US). Tenant data is isolated at the database layer via row-level security.
- **Object storage**: uploaded documents are stored in Cloudflare R2 or MinIO with encryption at rest.
- **Backups**: daily `pg_dump` to Cloudflare R2, retained 30 days.

If the organization owner chooses the EU region during onboarding, no customer content is ever shipped to US servers; the routing is enforced in code and monitored via Grafana.

## 5. LLM routing

Axon uses multiple LLM providers, chosen per-request by the router:

- **Primary**: Groq (Llama 3.3 or gpt-oss-120b) — US-based inference.
- **Fallback**: Google Gemini Flash — US-based.
- **Privacy mode**: Ollama on the organization's own VM — data never leaves.

Your prompt and retrieved document excerpts are sent to the selected provider. Each provider's privacy policy applies to how they handle that data:
- Groq: https://groq.com/privacy-policy
- Google Gemini: https://ai.google.dev/gemini-api/terms
- OpenAI / Anthropic / OpenRouter: their respective policies.

Organizations on the **Pro** and **Enterprise** plans can restrict the router to a subset of providers or switch to Ollama-only to keep all content on-premise.

## 6. Data retention

- **Account data**: kept until you delete your account.
- **Uploaded documents and chat history**: kept until you or the org owner deletes them.
- **Billing records**: kept for 7 years per tax regulations.
- **Logs**: rotated after 30 days.
- **Push tokens**: deleted immediately on sign-out or device uninstall.

## 7. Your rights

You can, at any time:
- Export all your data in JSON from Settings → Data → Export.
- Delete your account (irreversible; wipes your user row, memberships, chat, documents).
- Request account deletion via email: privacy@axon.dev.
- (GDPR) Request a Data Processing Addendum.
- (CCPA) Opt out of any future data-sharing (we currently do not share).

## 8. Children

Axon is a business tool and is not intended for children under 13 (or 16 in the EU). We do not knowingly collect data from minors.

## 9. Security

- TLS everywhere (Cloudflare + Caddy auto-HTTPS).
- Passwords stored as Argon2 hashes.
- Session tokens expire after 30 days of inactivity.
- Row-level security on every tenant-scoped table.
- Daily off-site backups.
- See [security-checklist.md](./security-checklist.md) for the full operational list.

## 10. Changes to this policy

If we change this policy in a material way, we will notify users in-app and by email 30 days before the change takes effect.

## 11. Contact

- Privacy + data requests: `privacy@axon.dev`
- Security vulnerabilities: `security@axon.dev` (PGP key at `https://axon.dev/.well-known/security.txt`)
- General: `hello@axon.dev`
