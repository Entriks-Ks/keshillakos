# Real-time notifications

## Audited workflows and implemented hooks

The repository already had authenticated Socket.IO chat, HTTP chat delivery, service requests in both legacy and canonical models, appointment cancellation, company invitations, role approval, profile/service/company moderation, reviews and platform feedback. No notification collection or bell was present.

| Workflow | Recipients | Integration |
| --- | --- | --- |
| New legacy request | Addressed provider | `requestService.createServiceRequest` |
| Legacy request status change | Requester; provider for admin changes | `requestService.updateRequestStatus` |
| Canonical request sent, including sending a saved draft | Profile owner and associated company owners/managers | `userRequestService.createUserRequest`, `sendExistingRequest` |
| Request closed/cancelled with pending deliveries | Affected provider owners/managers | `updateUserRequestLifecycle` |
| Accepted/rejected/completed delivery, changed response or offer | Requester; provider for admin changes | `updateDeliveryStatus` |
| Appointment cancelled | Requester and provider owners/managers, excluding actor | `appointmentService.cancelAppointment` |
| Company expert invitation | Invited expert | `businessService.inviteBusinessExpert` |
| Invitation accepted/rejected | Company owners | `acceptBusinessInvitation`, `rejectBusinessInvitation` |
| Invitation cancelled / member removed | Affected expert | `cancelBusinessInvitation`, `removeBusinessExpert` |
| Company suspension/reactivation/verification decision | Owners and team members | `reviewBusiness` |
| Verified company edits returning to verification pending | Admins | `updateBusiness` |
| Profile returned to pending review | Admins | `providerProfileService.updateProviderProfile` |
| Profile moderation decision | Profile owner | `moderateProviderProfile` |
| Service moderation decision | Provider owner/company managers | `serviceOfferService.reviewServiceOffer` |
| Role requested | Active admins | `userService.requestRoleChange` |
| Role request accepted/rejected | Requesting user | `reviewRoleRequest` |
| Admin changes account status or granted roles | Affected user | `updateUserByUid` |
| Existing chat message, HTTP or Socket.IO | Mesazhet unread count only; no bell notification | `chatService.sendMessage`, `chatUnreadService` |
| Published review | Provider owner/company managers | `ratingService.createReview`, `moderateReview` |
| Review needing moderation | Active admins | `createReview` |
| Review moderation or provider reply | Reviewer | `moderateReview`, `respondToReview` |
| Platform feedback submitted | Active admins | `platformFeedbackService.createPlatformFeedback` |

Excluded: draft saves, profile views, delivery read receipts, typing events, searches, login/logout, availability edits without a affected booking, automatic service publication, unchanged statuses, repeated identical review replies, and actions performed by the recipient themselves. Existing booking acceptance/completion notifications come from the delivery transition to avoid duplicates. No broadcasts for every newly published service; no new chat functionality, membership rules, moderation rules, or booking logic.

## Backend

- `models/Notification.ts`: recipient Firebase UID, event type, title/body, application link, deduplication key, read timestamp, creation/update timestamps.
- Unique recipient/event index suppresses repeated events. A partial unique recipient/coalescing index supports coalesced non-chat alerts. Chat does not create notification records; legacy `message:new` records are excluded from notification history, unread counts and read operations.
- Indexed recipient/date/ID history and recipient/read-state counts; pages contain 20 records.
- `services/notificationService.ts`: central persistence, recipient resolution, socket emission, history and read actions. Resolve company profile ownership plus owners/managers rather than notifying unrelated accounts. Private request/message contents are not copied into notification bodies.
- `services/socketServer.ts`: HTTP server attachment, existing Firebase authentication, inactive-account rejection, server-assigned `user:<verified UID>` rooms. Client-supplied UID/room names cannot select notification recipients.
- `services/realtime.ts`: shared room broadcaster; existing chat handlers register separately in `chatSocket.ts`. Typing is relayed only for an authorized joined conversation. Admin suspension/closure/deletion disconnects existing user sockets.
- `index.ts` waits for notification indexes before listening. Restart the backend after deploying compiled files.

Authenticated endpoints, always scoped to `req.user.uid`:

- `GET /api/notifications?page=1`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

Responses use `Cache-Control: private, no-store`. Read operations are idempotent, reject invalid IDs, and cannot read another recipient's notifications. There is no client endpoint to create notifications or select arbitrary recipients. Socket events are `notification:new`, `notification:count`, and `notification:read`; reads/counts synchronize all connected tabs.

Notifications are written after successful workflow persistence, then emitted. Offline clients recover persisted history on reconnect. Delivery errors are logged without changing the success of the business action. This is not a transactional outbox: a process crash between the workflow write and notification write, or a failed notification write, may omit that notification. Multi-instance deployment would need a Socket.IO adapter for cross-instance delivery; the current single-server architecture uses its existing in-memory adapter.

## Frontend

`NotificationProvider` mounts under the existing authentication provider. It dynamically imports Socket.IO only for authenticated users, authenticates using the current stored token on every connection, reconnects automatically, reloads history/counts after reconnect and visibility/online changes, aborts stale HTTP requests, and disconnects on logout/account changes. UI data from a prior UID is hidden immediately. Connection/API failures show retry controls. Expired credentials still require the existing app's sign-in flow; this change does not introduce new authentication or token-refresh behavior.

`NotificationBell` is added to the shared `DashboardTopBar` for all roles. It uses existing HeroUI ghost icon buttons, Dropdown, project colors and typography. Its responsive popover shows unread badge, history, individual read controls, mark-all-read, loading/error/empty states and pagination. Updates do not require refreshing the page. Notification links use existing routes; invitation/inbox links switch to an already granted capability when needed. Chat is separate: Mesazhet header controls, sidebar links and mobile navigation display the live unread message count.

No custom domain is required. Keep `VITE_API_URL` pointing at the existing Express origin (including localhost or a hosting provider's default URL). Socket.IO uses `/socket.io` on that origin and its normal polling/WebSocket upgrade. Hosting must allow long-lived Socket.IO connections; production HTTPS frontend should use an HTTPS API URL.

## Validation

Production builds: frontend and backend pass. Frontend suite: 25 tests pass, including seven incremental chat state/scroll tests. New backend tests cover persistence-before-emission, duplicate and concurrent unread-message suppression, scoped history/read state, failure handling, schema indexes, authenticated Socket.IO isolation/reconnect, and authenticated HTTP API isolation/cache behavior. Firebase and MongoDB are stubbed in these integration tests; they use real local HTTP and Socket.IO transports and do not write to the configured application database.

The backend suite retains the known unrelated projection failure. Notification/chat tests cover real socket visibility and room membership, atomic unread increments, active/hidden conversation behavior and exclusion of legacy chat records from the bell. The remaining existing unrelated failure is in `providerBusiness.test.ts`: public provider projection includes qualification claims. Browser verification with signed-in user accounts has not been performed.


## Chat unread separation

`GET /api/chat/unread-count` authenticates with the existing middleware and sums existing conversation unread counters across every conversation, independently of pagination. `chat:unread` is emitted only into the recipient's authenticated user room after a message or read action. The existing authenticated notification-provider socket also receives this separate event; no additional transport/server is created. Initial load, reconnect and visibility/online changes reconcile counters with MongoDB, and stale asynchronous count results are ignored.

Message sends use atomic `$inc` for the peer counter. An authorized chat socket records the currently viewed conversation; `conversation:visibility` marks it active only while visible and only after authorized room membership. Active peers stay at zero unread. Hidden/closed threads accumulate unread; returning to a visible conversation marks it read and synchronizes tabs. Leave/disconnect clears active presence. Both HTTP and socket message sends emit existing message/conversation events centrally once, avoiding duplicate delivery. Existing outgoing-error toasts remain; incoming messages do not produce notifications/toasts.

The shared Mesazhet icon uses the same HeroUI ghost-button pattern as the notification bell and opens existing role-specific messages routes. Non-chat notification workflows and persistence are unchanged. Existing chat notification records are retained in storage but hidden; no destructive data migration is performed.

## Incremental chat rendering

Incoming `message:new` events merge messages by MongoDB message ID. `conversation:updated` patches the addressed row's preview, timestamp and unread state, retaining other row objects and list order. The global unread counter is independent and never triggers a conversation-list fetch. A previously unknown conversation fetches only its own metadata; overlapping metadata requests are shared.

The list loads on initial navigation, explicit search/pagination, and quietly after an actual socket reconnect. Reconnect reconciliation preserves rendered rows, existing message history and identity, and never sets a list/thread loading state. Thread caches restore opened conversations and their scroll offsets immediately; room joins still use the existing server acknowledgement to reconcile missed messages. REST message history is a fallback when the join fails, or is requested explicitly through the older-history control. Backend message events, routes and MongoDB persistence are unchanged.

The reader's scroll position is preserved when away from the bottom, including while prepending older history. Readers within 80px of the bottom follow appended messages smoothly. Messages and conversation rows retain stable ID keys. State tests simulate sender/recipient updates, visible/hidden conversation unread handling, message echo/reconnect deduplication, stable list ordering/object identity, and scroll anchoring. These tests do not replace a signed-in two-account browser check; that check has not been performed.
