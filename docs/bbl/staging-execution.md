# PR 5 staging execution and approval package

## Implemented, not deployed

This change continues `codex/bbl-source-recovery-integration` in `rgollhofer-wq/Answer-Engine-`. It preserves the installed deterministic Sammy interface, session memory, evidence rules, business registrations and durable lead format. It does not add AI or replace the existing architecture.

Before editing, all six installed plugin files were read through the staging WordPress editor and matched the recovered SHA-256 manifest exactly. Staging is still v0.4.1. This branch retains the v0.4.2 email-disabled default and corrects the route installer.

The existing loader's `dirname(__DIR__, 3)` is correct: from `category/home-services/plumbing` it reaches the clone root. The actual installer defect was accepting a symlinked root or clone `index.php`, allowing the loader to resolve outside the intended entrypoint. The patch rejects those cases, verifies the canonical index path, and uses platform directory separators. Existing unknown files and route symlinks remain refused. The generated loader bytes are unchanged.

The former negative tests could catch their own failed assertions and incorrectly pass. Rejection assertions now run outside the catch. The route test executes the generated loader against distinct synthetic clone/production indexes and requires the clone marker. Linux CI additionally requires root, index, route-file and route-directory symlink rejection.

## Verified live staging behavior before deployment

URL: https://backedbylocal.com/backed-by-local/category/home-services/plumbing/

| Customer turn | Observed response |
| --- | --- |
| My water heater is leaking. | Asks which city and says it will retain the plumbing details. |
| Denver, today. | No Verified Match; cannot confirm help today; asks whether gas, electric or tankless. |
| It is electric. | No Verified Match; retained intent is `water-heater · denver-co · today-requested · electric`. |

No contact information was entered and no lead was submitted. The currently installed code still calls external email, so a safe live persistence/admin test must wait for the reviewed mail-disabled patch.

Both injected REST destinations are under `/backed-by-local/index.php?rest_route=/bbl/v1/`; the script and navigation links are clone-scoped. The demo declares `noindex,nofollow`. The exact URL/filesystem guard and administrator permission checks pass automated tests. This verifies the Sammy surface, not complete infrastructure isolation: no database credentials were inspected, and previously identified root-relative links on the old clone homepage still escape to production. Keep the demonstration on the direct Sammy URL; do not use legacy homepage forms.

The existing staging sponsorship test at `/?page_id=907` rendered six separate Sponsored placements: leaderboard, featured, category, in-content, supporting and footer. Each sample link stayed on that clone page. No sponsorship code, settings or content is changed. Post-deployment repeat verification remains required.

## Automated validation

Local PHP 8.4.28: all four plugin files lint clean; 23 engine, 14 plugin-boundary, 8 route and 8 separate-process persistence/admin checks pass. Four additional symlink cases are explicitly skipped on Windows because this account lacks symlink privileges; Linux CI requires all four. Three JavaScript interface tests and JavaScript syntax pass.

The persistence test invokes the real plugin in separate PHP processes, using a shared file-backed WordPress boundary. It saves one synthetic `example.invalid` lead, retries without duplication, reloads all three conversation turns, and renders the same ID/contact and `No Verified Match | disabled` in the admin method. A mail-call counter stays zero. This is an automated contract test, not evidence of a live WordPress database submission.

Existing Fastify backend limitations remain unchanged: five tests passed in the recovery baseline; the answer suite is blocked by an ungenerated Prisma client, generation fails P1012 for SQLite Json fields, and TypeScript build has existing Redis/logger/confidence errors. The WordPress plugin has no dependency on this backend.

## Screenshots and outstanding blockers

The live conversation and six sponsorship placements were observed through browser accessibility/DOM and recorded locally. Actual screenshot attempts timed out. Native capture identified a locked Windows session; it showed the lock screen, not the website. No fabricated or substitute page screenshots are supplied. Unlocking Windows is required to capture the real pages.

Remaining: approval of the exact two-file staging patch; deployed hash verification; live synthetic lead receipt and its matching staging admin record with email disabled; post-deployment sponsorship check; actual screenshots. The demonstration is not declared fully complete.

## Exact deployment proposal — approval required

Target only `https://backedbylocal.com/backed-by-local`, existing plugin directory `backed-by-local/wp-content/plugins/bbl-answer-engine-mvp/`.

1. Re-check all six installed hashes against `recovered-staging-manifest.json`; stop if anything changed. Confirm this clone's `home_url`, real filesystem root and existing index are not symlinks. Do not edit production or import a database.
2. Replace only `bbl-answer-engine-mvp.php` and `route.php` with this branch's payload. Before/after SHA-256 values are in [staging-deployment-manifest.json](staging-deployment-manifest.json). The supplied local ZIP contains `payload/`, original `rollback/` copies and that manifest. No plugin install, activation, permalink flush, content update or sponsorship change is needed.
3. Keep `BBL_STAGING_ENABLE_EMAIL` absent or strictly false; if already true, stop for a separately reviewed configuration change. Re-read deployed files and verify payload hashes before any submission.
4. Use Tools > BBL Sammy to run the scoped route installer only after approval. The existing route should report already installed; any unknown file is preserved and must be investigated, not overwritten.
5. Repeat the three-turn conversation above. Submit one synthetic contact named `Synthetic PR5 Tester`, email `pr5-test@example.invalid`, blank phone, no provider, consent checked. Require a persisted receipt with delivery status disabled. Reload Tools > BBL Sammy and locate that exact receipt ID; verify the conversation, consent, No Verified Match and disabled status. Do not infer email delivery or create a verified provider.
6. Repeat sponsorship and scoped-link checks; capture screenshots of the conversation, receipt, same-ID admin record and placements. Record actual outcomes in PR 5. Stop on discrepancies.

## Rollback

If the patch fails before lead testing, restore only the two corresponding original files from `rollback/bbl-answer-engine-mvp/` and verify their before hashes. Do not restore a database or delete existing leads/sessions. The route loader is unchanged; do not remove the existing route. If any unexpected route file appears, preserve it for inspection.

Restoring the original main plugin also restores its email-sending behavior. Therefore stop all lead tests before rollback and keep the demo unused for submissions afterward. Never interpret rollback as authorization to send mail. A route-only problem can be rolled back by restoring only `route.php`, retaining the mail-disabled main plugin. Production and sponsorship assets must remain untouched.
