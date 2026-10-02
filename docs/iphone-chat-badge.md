# iPhone Home Screen badge

2026-09-29: Counts incoming unread non-deleted personal messages across enabled events with checked-in attendance. No group messages or group pushes.

`deploy/personal-chat/functions/eventChatBadge.js` is shared by getEventChatBadge (verified authenticated email only) and personal push delivery. The count is absolute, not incremented per delivery, so duplicate push deliveries do not inflate it. If counting fails, the normal notification still goes out without changing the badge.

Foreground clients with Badging API support refresh every 30 seconds, on auth changes, visibility/online changes and successful personal read/delete/reset actions. Logout clears the local badge. An offline/read-on-another-device change is reconciled when the app becomes active; no silent push is sent just to reset a remote badge.

Requires installed Home Screen web app on iOS 16.4+, allowed notifications and enabled badges. Not verified on physical iPhone; automated counting and service-worker display tests pass. No real test pushes sent.

Deploy only getEventChatBadge, sendEventLiveMessage and processEventChatNotifications from deploy/personal-chat/firebase.json. Profile functions remain sourced from deploy/profile-logo; do not deploy those from personal-chat. Publish frontend with normal hosting-only deploy after build.
