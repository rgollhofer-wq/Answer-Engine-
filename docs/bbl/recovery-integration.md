# BBL source recovery and staging integration

Recovered November 20, 2026 through existing authenticated WordPress read-only views. No production save, plugin activation, import, synchronization, deployment, lead submission or email test was performed.

## Environments and source of truth

| Surface | Verified implementation |
|---|---|
| Production `https://backedbylocal.com` | Active BBL Answer Engine MVP 0.3, single PHP file; WordPress 7.1.5 |
| Existing clone `https://backedbylocal.com/backed-by-local` | Active BBL Answer Engine MVP — Staging Phase 1 0.4.1, six files |
| Repository main and `codex/bbl-sammy-denver-staging-phase1` | Both at `81ccf751b13b346553d097e935ce25e58267d4c8`; Fastify/TypeScript/Prisma backend, no recovered WordPress plugin |
| This branch | Reconciles the existing clone under `wordpress/bbl-answer-engine-mvp`, with a minimal 0.4.2 mail safety change and isolated regression tests |

The clone is identified in production WP STAGING as the running **Backed by Local** clone. Other clones exist; none were synchronized or modified. LocalParts PR #91 is unrelated and untouched by this work.

## Recovered components

- Production MVP 0.3 PHP: POST `bbl/v1/answer`; accepts `question` and `city`; explicit ZIP mappings, approximate city clusters, keyword categories, five published business records via `bbl_city` and `bbl_category`; `gpt-4.1-mini` Chat Completions; returns `answer_html` and `raw_results`.
- Server credential references only: `BBL_OPENAI_API_KEY` constant, otherwise `OPENAI_API_KEY` environment variable. No credential values or wp-config export.
- Production home page 96: rendered Elementor HTML/CSS/JS, including `sammyOutput`, `sammyInput`, `sammyAsk`, canned `getAnswer` replies, example buttons, directory/category navigation and the business intake form markup.
- Production header 1435 and footer 805: rendered source and native Elementor JSON exports. Footer's Ask BBL routing table handles Lynnwood dentists, otherwise routes to `/ask-bbl/` with a question query parameter. No AI call occurs in that footer handler.
- Code Snippets: five listed; four inactive samples, one active `REST API` snippet. Its observed code returns true from `rest_authentication_errors` when no earlier result exists and removes template_redirect actions for REST requests. It is **not** imported or activated by this branch.
- Shortcoder production list: zero shortcodes. There is no Shortcoder Sammy source to migrate from the inspected environment.
- CPT UI registration JSON: `business`, `cities`; `bbl_category` and `bbl_city` on business; separate `business_category` on cities.
- Production category inventory: 65 terms with names, slugs and displayed counts. City taxonomy: Aurora (`aurora-co`), displayed count zero.
- ACF Business Details native JSON export: `phone_number`, `address`, `website`, `business_description_short`, `google_maps_link`, `business_hours`, `business_logo`, `tags__keywords`; location rule targets `business`, and the group is active. The inspected business draft had no filled phone/address/website and no exposed verification evidence fields.
- Production/staging plugin inventories and versions, stored locally, not production database dumps.
- Staging plugin: main class, deterministic `engine.php`, scoped `route.php`, `demo.php`, `sammy.js`, `sammy.css`, recovered verbatim before the small mail change.

Private working exports remain outside this repository. This repository contains reviewed staging source and synthetic test fixtures, not business records, mail settings, customer records, tokens or raw production configuration exports.

## Verified gaps and behavior differences

| Area | Production | Existing clone | Integration consequence |
|---|---|---|---|
| Conversation | Homepage canned responses; separate OpenAI endpoint with no conversation-history input | Server-side deterministic slot retention; 30-turn limit, user-owned 24-hour transient | Do not describe the clone as live AI. A later AI adapter must retain the evidence policy and response contract. |
| Geography/category | Multi-state ZIP/cluster maps; broad keyword categories; defaults to Lynnwood | Denver plumbing pilot, several explicit city/ZIP corrections, asks for missing city | Preserve narrow verified pilot; do not silently restore default-Lynnwood or radius guesses. |
| Business coverage | Two drafts, zero published business posts | Zero business posts | No verified provider can be demonstrated from present records. Homepage featured cards are not evidence-backed business CPT records. |
| Custom fields | MVP reads `bbl_phone` / `bbl_address`; ACF uses `phone_number` / `address` | Phone adapter already falls back between both names | Preserve compatibility adapter; repair address mapping only when a reviewed display consumer needs it. |
| Verification | Production query does not enforce dated verification metadata | `_bbl_evidence` requires status, source URL, reviewer, dates, city and service; expired/incomplete means Possible | Do not copy drafts, featured cards or sponsored flags into verified recommendations. No existing verified business evidence was established. |
| UI placement | Elementor home + footer; `/ask-bbl/` has explanatory content but no customer form in the inspected DOM | Standalone admin-only plumbing demo using clone REST URLs | Keep the existing interface and route. Embedding in Elementor is a separate reviewed content change. |
| Leads | Homepage form posts to `/get-featured/`; its server handler is not present in the recovered MVP or inline script. WPForms contact form exists separately | Namespaced durable option, consent snapshot, version check, verified-provider validation, idempotent receipt | This branch retains storage semantics and disables external email by default. |
| Email | WP Mail SMTP selected `mail`; Site Mailer also active; conflict and recent failure notices | Both mail plugins also active; lead code invokes wp_mail and never verifies delivery | Never claim delivered; choose one transport and verify it only after approval. No emails sent here. |
| Dependencies | ACF 6.8.12, CPT UI 1.19.3, Code Snippets 4.1.0, Elementor/Pro 4.4.1; Fluent Forms 6.2.17 | ACF, CPT UI, Code Snippets and Fluent Forms absent from inspected plugin list; Elementor 3.32.5/Pro 3.32.3 | Clone plugin already registers missing CPT/taxonomies in memory and uses WordPress core metadata. No plugin install required for this reconciliation. |

Production MVP has no request-rate/output budget control visible in the recovered file, returns model HTML without an allowlist, and asks for 2–3 recommendations even with an empty query result. These are release blockers for transplanting it as-is, not reasons to replace the existing staging engine.

The WPForms builder reported **Session expired**, including after the requested retry. Its already-loaded form controls nevertheless allowed a read-only, redacted configuration export: notifications enabled, subject `New Entry: Simple Contact Form`, reply-to `{field_id="2"}`, body `{all_fields}`, message confirmation, no redirect, no file/CSV attachments. Recipient values are redacted; actual delivery and the current server acceptance of these settings were not tested. Fluent Forms lists three active demo/subscription forms; WPForms lists Simple Contact Form 1151 and warns Lite entries are email-only. No submissions or customer entries were opened. Fluent Forms notification integrations remain unverified. The home page was recovered as rendered Elementor markup, not a complete editable page JSON export; header/footer native template JSON was exported.

Additional navigation gaps: the production footer's configured `/washington/lynnwood/dentists/` destination renders “The page can’t be found.” The clone's older Elementor home has a separate live form and root-relative footer links such as `/directory/` and `/contact` that escape the clone to production; no links were followed and no form was submitted. These require scoped link review before broader staging demonstrations. Shortcoder has zero entries in the clone as well.

## Safe integration completed in this branch

1. Recovered the existing clone into a reviewable plugin directory; retained its route, IDs, styles, response fields, data model and permission guard.
2. Preserved exact clone URL + filesystem basename checks, administrator-only endpoints, consent, evidence gating and commercial-ranking separation.
3. Changed only mail opt-in behavior: undefined/false `BBL_STAGING_ENABLE_EMAIL` persists a test request with `delivery_status=disabled` and never calls wp_mail. Enabling mail requires separate approval; no deployed configuration was changed.
4. Added isolated PHP and JavaScript contract tests. They use in-memory WordPress doubles, example.invalid records and a temporary synthetic route directory; no real services or leads.

## Recommended remaining sequence

1. Finish Fluent Forms notification review and verify WPForms after resolving its session warning; obtain full editable home-page Elementor JSON without saving or exporting secrets if an editable page migration is required. Compare any remaining business evidence before migration.
2. Review this PR and its source manifest. Re-check deployed clone hashes before any approved installation because the live clone currently exists outside Git history.
3. Approve deployment of only the reviewed plugin files into the named clone. Do not refresh the clone or import production database/options. Keep email disabled and use only synthetic contacts.
4. Verify existing clone navigation, isolation, multi-turn context, empty/expired evidence and safe receipt behavior. Add a genuine reviewed business record only through a separate evidence approval process; never manufacture coverage.
5. Integrate an optional bounded AI phrasing/clarification adapter using the recovered provider architecture. Credentials remain server-side; business selection stays deterministic. Add refusal, HTML safety, budget, timeout and history tests before enabling it.
6. Review Elementor embedding and route compatibility without replacing the existing Sammy UI. Resolve the two-mailer conflict and independently verify a synthetic notification only after explicit approval.
7. Broader city/category coverage, real lead routing and production release remain separate approval gates. No merge, publication or deployment is authorized by this branch.

## Validation and limits

- PHP 8.4.28: four plugin files pass syntax checks; 23 engine checks, 14 WordPress boundary checks and 8 scoped route checks pass locally (12 on symlink-capable Linux); 8 separate-process persistence/admin checks also pass.
- Node: three interface tests pass; syntax check passes. Tests cover retained context, user isolation, invalid/expired evidence, no inventory fabrication, no sponsored ranking effect, consent, stale requests, unverified providers, no email by default, idempotency, scoped route preservation and text-safe rendering.
- The existing Fastify suite has five passing tests; its answer suite cannot load the ungenerated Prisma client. `prisma generate` fails P1012 because the existing Prisma 5 SQLite schema declares three Json fields. The existing TypeScript build also reports Redis, logger and confidence-narrowing errors. These files are unchanged by this PR; the WordPress plugin does not depend on that backend.
- No live AI request was sent during this read-only recovery. No new runtime changes have been deployed. Passing isolated contracts does not substitute for approved staging end-to-end deployment verification.

See [staging execution and approval package](staging-execution.md) for the subsequent installer correction, live conversation observations, exact patch, and rollback.
