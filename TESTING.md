# Smart Waste Management System Testing Guide

This guide lists recommended manual and automated checks for the shared authentication, sync, and offline capabilities that span the backend, web frontend, and mobile client.

## Prerequisites
- Backend server running locally with a seeded MongoDB instance.
- Web client served via `npm start` in `web-frontend/`.
- Expo client running the mobile app (use Expo Go or simulator).
- Test accounts for resident, staff, and admin roles.

## Authentication & Token Refresh
1. Log in with each role on web and mobile.
2. Using browser devtools / mobile debugger, shorten the access token lifetime (or wait for expiry) and ensure:
   - Requests transparently refresh the token.
   - Refresh token rotation occurs (new `refreshToken` returned and stored).
   - Forced refresh failure (e.g., revoke token) redirects to login and clears storage.

## Offline Queue Replay
1. **Web collections & pickups**
   - Go offline, submit a manual collection scan and pickup request.
   - Return online and confirm the queue flushes, entries appear in activity lists, and no duplicates remain.
2. **Mobile pickups & payments**
   - Disable network (Airplane mode), create pickup + payment.
   - Re-enable connectivity; verify replay succeeds and local queue clears.

## Sync Endpoint Validation
1. Trigger data changes via backend (new pickups, collections, transactions).
2. Confirm `/api/sync/updates` polling populates dashboards without page refresh on both platforms.
3. Validate merge logic by creating records with matching identifiers and newer timestamps; ensure newer data replaces older entries without duplication.

## Role-Based Access
1. Resident should not see staff-only navigation (Scan tab/page, collection statistics).
2. Staff should see scan tools and collection stats but not admin-only reports.
3. Admin dashboard should include system analytics and reports; verify `/api/sync/updates` delivers full dataset only to staff/admin if required.

## Connectivity Feedback
1. Toggle offline/online state and observe banner/toast indicators on web and mobile.
2. Ensure actions are disabled or queued appropriately while offline.

## Notifications (Mobile)
1. Accept push notification permissions.
2. Trigger a server-side notification (if available) or use Expo push tool to confirm device registration works.

Document results of each scenario in your QA log. Expand or automate as needed for regression coverage.