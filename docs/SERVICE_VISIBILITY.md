# Published service visibility

The public list and detail APIs and the public provider profile route previously hid services unless the owner had an active Pro subscription. On 2026-10-19, the actual database contained six published, public, approved ServiceOffer records, four owned by an individual expert and two by an active company. Their profiles were published and approved; both service categories were active. Neither owner had an active Pro subscription. The hosted API returned zero services.

Public visibility now follows publication, moderation, profile/owner eligibility, active category and business checks, independently of subscription. Pro requirements for service creation/editing remain unchanged. Detail requests use the same eligibility pipeline as listings. Original service records, titles, owner/company/expert references, categories, localization, and client response structures are unchanged.

Verification used actual records through a local instance of the compiled production route/service modules. The verification server rejected non-GET requests and database write methods; review maintenance and analytics writes were disabled for that verification session. It returned all six services, matching the original IDs, titles, categories and relationships. All six detail and owner-profile responses, category filtering, counts and pagination passed. The actual web offers page and a linked detail page were inspected. The mobile API adapter and Android/iOS OffersScreen card rendering passed against those same real API results. Direct emulator UI access was unavailable; the user chose automated mobile checks.

Read-only integration commands (set the API URL to the instance being verified):

```sh
# backend directory; reads MONGODB_URI from its existing .env
KESHILLAKOS_SERVICE_API_URL=http://localhost:4000 node --test test/serviceVisibility.integration.cjs

# mobile-app directory; uses the actual HTTP adapter and screen with native component adapters
KESHILLAKOS_SERVICE_API_URL=http://localhost:4000 node --test test/serviceVisibility.integration.cjs
```

The tracked compiled backend modules are updated. Deploy/restart the backend serving the hosted API to apply this fix to existing web/mobile installations. Local validation does not alter Render. No database migration, service duplication, subscription change or record update is needed.
