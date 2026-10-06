# KëshillaKos pagination audit

Audited the existing React pages/dashboard panels, API adapters, Express GET routes and Mongoose collection reads before implementation, then repeated the collection/list audit after implementation. No new pagination library or dependency was added.

## Initial findings

Growing collections included public services and provider directories, legacy experts, users/access requests, platform feedback, customer requests/provider deliveries/admin requests, reviews/moderation queues, rateable providers/completed interactions, conversations/messages, appointments, availability slots, and business members/invitations. Several reads previously returned entire collections or silently stopped at 50/100 records. Frontend search/filtering and sliced reviews could hide records outside those limits. Dashboard counters were calculated from returned arrays.

Small configuration datasets and fixed overview/recommendation previews were distinguished from full browsing lists; those do not need page controls.

## Implemented endpoint and page coverage

All endpoints below accept positive integer `page` and `limit`, cap `limit` at 100, and return `{ page, limit, total, totalPages }`. An empty collection returns page 1 and zero total pages. Out-of-range pages clamp to the last available page, including after deletions.

| Endpoint | Default limit | Frontend use / behavior |
| --- | ---: | --- |
| `GET /api/services` | 12 | Offers marketplace services tab; full matching set filtered/sorted in MongoDB; page retained in URL. |
| `GET /api/providers` | 12 | Marketplace expert/company tabs; search, taxonomy, city, language, delivery, verification and ratings applied before MongoDB paging; global tab counts. |
| `GET /api/providers/:uid` | 12 | Public profile services and company experts; independent `page` / `expertsPage`, both retained in URL, with separate metadata. |
| `GET /api/services/:id` | 12 | Public service detail company experts; nested `expertsPagination`. |
| `GET /api/services/mine` | 20 | Expert/company service management and bounded overview previews; active/total summaries remain global. |
| `GET /api/service-offers` | 12 | Canonical public compatibility API; published profile, category and active business eligibility precede paging. |
| `GET /api/service-offers/mine` | 20 | Canonical managed offers API. |
| `GET /api/experts` | 12 | Legacy compatibility directory; canonical profiles and legacy experts paged together before enrichment. |
| `GET /api/experts/mine` | 20 | Legacy managed experts API. Current team UI uses the business team endpoint. |
| `GET /api/admin/users` | 20 | Admin users table; search and role filters before paging. |
| `GET /api/admin/users/role-requests` | 20 | Separate admin access-request page control. |
| `GET /api/feedback` | 20 | Admin feedback list; global unread total. |
| `GET /api/requests/mine` | 20 | Customer requests; status tabs page separately and reset to page 1. |
| `GET /api/requests/inbox` | 20 | Expert/company inbox; status filters and awaiting/accepted/completed ordering happen on the server. |
| `GET /api/requests/all` | 20 | Admin requests list and fixed admin overview preview. |
| `GET /api/ratings/provider/:providerUid` | 12 | Shared public reviews and expert/company review panels; rating statistics/star buckets computed over all matching reviews. |
| `GET /api/ratings/subject/:scope/:id` | 12 | Scoped public reviews API. |
| `GET /api/ratings/providers` | 20 | Customer “rate providers” list; completed interaction eligibility/grouping before MongoDB paging. |
| `GET /api/ratings/eligible/:providerId` | 20 | Eligible completed interactions compatibility API. |
| `GET /api/ratings/eligible-uid/:providerUid` | 20 | Public rating form; server-paged interaction choices; self-owned/already-reviewed interactions excluded before paging. |
| `GET /api/ratings/moderation/pending` | 20 | Independent pending/published API pages (`publishedPage`); metadata retained by typed frontend adapter. No moderation browsing panel currently exists. |
| `GET /api/chat/conversations` | 20 | Customer/expert/company messages sidebar; server search; active conversation remains open across list pages; global unread count. Realtime changes refresh server ordering. |
| `GET /api/chat/conversations/:id/messages` | 50 | Message history keeps existing `before` cursor and adds page metadata; older-history control requests bounded server batches. |
| `GET /api/appointments/mine` | 20 | Customer overview requests the next 10 upcoming appointments; full API supports page/limit. |
| `GET /api/appointments/provider` | 20 | Expert/company overview requests the next 10 upcoming appointments; global upcoming count. |
| `GET /api/availability/mine` | 50 | Availability calendar; free/busy totals cover all slots. |
| `GET /api/availability/provider/:uid` | 50 | Public profile schedule and booking calendar; open/schedule views paged in MongoDB; global free/busy totals prevent off-page availability from disabling booking. |
| `GET /api/businesses/:id/team` | 20 | Company members and invitations each have a control (`invitationsPage`); service responsibility selectors can browse member pages while retaining selected people. |
| `GET /api/businesses/invitations/mine` | 20 | Expert invitations; accepting/rejecting refreshes and clamps current page. |

Standalone collection queries count and apply MongoDB skip/limit before loading full records or card enrichment. Mixed canonical/legacy directories and request lists use aggregation unions. Business members/invitations are embedded in a single business document: the server slices these arrays before related-user/profile enrichment, and sends only the requested rows. Existing ownership/management checks remain in place.

## Shared UI and state

`frontend/src/components/KeshillaPagination.tsx` is the single reusable pagination component. It follows the current [HeroUI v3 Pagination compound API](https://heroui.com/en/docs/react/components/pagination#customization): `Pagination`, `Summary`, `Content`, `Item`, `Link`, `Previous`, `Next`, and `Ellipsis`, with `onPress`, `isActive`, and `isDisabled`. It uses a white background, subtle slate borders, blue active state, no shadows/gradients, Albanian range text, accessible labels/focus styling and wrapping mobile controls. It hides when there are at most one page. There is no v2 `total/page/onChange/showControls` usage on the HeroUI component.

Search/filter/sort/tab changes reset list state to page 1. Public marketplace and provider-profile page numbers use URL query parameters. API helpers retain existing array-based callers while attaching typed pagination/summary metadata. Deletion/status/team mutation flows reload the current page and use the server's clamped page rather than filtering a full collection in React.

## Intentionally unpaginated

- Countries, cities by country, domain/category/subcategory catalogs, language/delivery/audience/offer-type options, roles and navigation items: small curated configuration/choice lists.
- Account-owned/managed business and provider-profile context selectors: small per-account configuration contexts, required for existing ownership and editor selection flows.
- Single-record details, exact-email expert lookup, authentication/profile completion, rating eligibility checks for a single submitted interaction, mutations and upload responses: not collection browsing pages.
- Home AI matching: fixed ranked top recommendations rather than a browsable directory; existing recommendation limits preserved.
- Overview cards: fixed recent/upcoming previews and team/avatar snippets with existing links into the full paginated lists. Their backend requests are bounded and counters use global metadata. No pagination controls inside small previews.
- Service photo galleries and bounded profile photos, weekly/hour calendar choices, and category shortcut strips: limited presentation/configuration items, not growing search results.

## Validation and known limits

- Frontend and backend production TypeScript builds pass.
- Frontend tests: 16/16 pass. Backend tests: 54/55 pass; the unchanged `providerBusiness.test.ts:74` assertion that public projection excludes `qualificationClaims` already conflicts with the existing `toPublicProvider` projection. No unrelated projection change was made.
- New pagination checks cover strict query validation, capped sizes, empty/deleted last pages, deletion between count/read, page-number ellipses and filtering before paging.
- Read-only live public API checks confirmed distinct page IDs, full-set search counts, invalid page rejection, and page 999 clamping.
- Read-only database checks passed for customer/inbox/admin requests, rating eligibility/rateable providers, conversations/message history, managed services, team rows and a 192-slot schedule (page 999 clamped to page 96 at limit 2). Server service filters matched existing frontend semantics for ten search/filter combinations.
- Browser checks confirmed active page/summary, URL updates, search resetting page 1, hiding controls on a single page, and the responsive 375px layout.
- Frontend lint completes with warnings, including existing React effect/dependency warnings. Vite retains its existing large bundle warning.
- Authenticated UI mutation flows were reviewed in code; no live records were created or deleted for testing.
