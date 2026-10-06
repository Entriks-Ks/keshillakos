# Chat safety and context additions

The existing pair-based Conversation and text Message models, Firebase-authenticated
Socket.IO rooms, incremental message updates, deduplication, history, read state,
and global unread count remain in use. Chat sends do not create notifications.

## Authorization

`chatService.assertParticipant` protects history, metadata, details, read operations,
reports, blocks and sends. HTTP derives the sender from the authenticated request;
Socket.IO derives it from verified socket data, ignoring caller-supplied identities.
`openOrGetConversation` now enforces start rules centrally: a client may contact an
account with existing provider capabilities, while provider-initiated outreach
requires the existing request/delivery relationship. A supplied service must belong
to that provider (current offers and legacy services are supported). Start checks
also reject inactive accounts and nonparticipant senders before any thread write.

## Reports and blocks

Authenticated participant-only endpoints:

- `GET /api/chat/conversations/:id/details`
- `POST /api/chat/conversations/:id/report` with a 5–500 character `reason`
- `POST /api/chat/conversations/:id/block` with boolean `blocked`

Reports retain PlatformFeedback storage but have a separate admin Raportime page,
sidebar item and admin-only API. Normal Feedback queries/read actions exclude
reports. The
server derives reporter/target identities and persists structured `chatReport`
metadata. Admins see batch-resolved names/photos/roles, structured reasons and
verified context, never technical message strings or IDs. Review statuses are
new/reviewing/resolved/dismissed; legacy read reports appear as reviewing.
One pending report per reporter/conversation is enforced by a partial
unique index. An admin receives a moderation notification, without copying chat
message bodies into the bell or activity feed. Reports do not automatically ban
users or change request status.

ChatBlock stores a directional user block. Either direction disables sends and
typing for both parties, across all their threads. Only the blocker can remove
their own block. Existing history and request/appointment workflows remain
available. `chat:availability` uses the existing authenticated user rooms; the UI
updates only active thread details, without reloading conversations or messages.
Startup initializes block/report indexes before serving requests.

## Request context

The existing request creation flow supplies its verified delivery ID to the chat
service. This optional Conversation reference requires no migration. Details
revalidate the seeker and provider against the request and delivery before
returning title/status. Older conversations display context only for one
unambiguous matching delivery or legacy request; ambiguous associations remain
hidden. Draft requests are excluded. The context is fetched on thread selection
and reconnect, never on incoming messages. Status is refreshed on reopening or
reconnect, rather than adding a new request-status socket system.

The context link uses existing request/inbox pages. Those pages do not currently
have individual request detail routes, so the link opens the corresponding list.

## Presence

Previously the sidebar's Online label represented the viewer's React socket state;
there was no server-owned peer presence/last-seen implementation. That connection
label now reads Lidhur. Peer presence is tracked per authenticated socket ID, including
the navbar notification connection, so a user remains online while any app tab/device
is connected. The last socket disconnect sets last seen. Socket.IO pongs renew a
50-second lease; its 25-second ping interval and 20-second timeout detect dropped
transports. A 5-second server sweep expires stale leases even if a disconnect event
was missed. No client polling or MongoDB presence/typing writes are added.

Presence subscriptions accept conversation IDs, verify membership, resolve peers
on the server, and join only authorized presence rooms. Changes patch an isolated
frontend presence map, without changing message/conversation arrays. Reconnect
resubscribes and stale initial snapshots cannot overwrite newer events. Socket
ownership now follows the signed-in UID as well as login state, preventing an
account switch from retaining the previous user's connection.

Presence/last seen is in memory, retained for 24 hours while the server stays up.
After restart or expiry, offline contacts show Offline without an invented last
seen. Multiple server instances require a shared Socket.IO adapter and distributed
connection/lease registry; the existing app uses a single server process.

## Attachment preparation (disabled)

Existing S3 infrastructure is reused, with an optional private cache policy.
`chatAttachmentPolicy` defines PDF/JPG/PNG/DOC/DOCX, a 5 MB ceiling, and generated
`chat-private/{conversationId}/{randomFileId}.{extension}` keys. Those keys are
rejected by the unauthenticated `/media` route. S3 writes to this namespace must
explicitly opt into private storage. No chat upload/download endpoint, message
attachment field, file chooser, or presigned URL is exposed.

Before enabling attachments: enforce participant authorization for uploads and
downloads, validate actual file signatures and DOC/DOCX container contents, scan
for malware, enforce size/count/rate limits, associate each file with its persisted
message, and clean up failed/orphaned uploads. Confirm S3 Block Public Access and
private bucket/IAM policies; private cache headers alone do not restrict S3 access.
Downloads must be authenticated, no-store, nosniff, and attachment-disposition.

## Validation and limitations

Tests cover valid existing start rules, foreign identities/services, provider
outreach, foreign socket joins/sends, blocked sends/typing, owner-only unblock,
report validation/deduplication, request context scoping, private file keys, and
existing unread/reconnect invariants. Database operations are mocked; socket room
tests also use actual local Socket.IO transport. No signed-in two-user browser
session or live S3 upload was performed.
