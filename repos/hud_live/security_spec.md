# Firebase Security Specification

## Data Invariants
1. **Users**: A user can only create their own profile. Once a role is set, it cannot be changed.
2. **Requests**: Only 'clients' can create requests. Only the owner of a request can update it (limited fields) or delete it.
3. **Bids**: Only 'vendors' can create bids. A vendor can only bid once per request. Only the vendor or the request owner (client) can see the bid amount (if privacy is required, though usually bids are private in a marketplace).

## The Dirty Dozen (Payloads to Block)

1. **Identity Theft**: Authenticated User A tries to create a profile for User B.
2. **Role Escalation**: Authenticated User A (Client) tries to update their profile to `role: "vendor"` to access vendor features.
3. **Ghost Fields**: Authenticated User A adds `isAdmin: true` to their profile.
4. **ID Poisoning**: User tries to create a document with an ID that is 2KB of junk characters.
5. **Resource Exhaustion**: User tries to save a 500KB string in the `fullName` field.
6. **Orphaned Bid**: User tries to create a bid for a request ID that doesn't exist.
7. **Unauthorized Posting**: A 'vendor' tries to create a Request (only clients should).
8. **Shadow Update**: A user tries to update the `winner` field of a request they don't own.
9. **Timestamp Spoofing**: A user sends a `createdAt` timestamp from 2020.
10. **State Skipping**: A user updates a request status from `live` to `completed` without being the owner.
11. **Negative Budget**: A user sends an `amount: -5000` in a bid.
12. **PII Leak**: A guest tries to `get` a user's profile containing their `phone` and `email`.

## Test Runner (firestore.rules.test.ts)
(This will be implemented if a test framework is available, but the logic will be reflected in the rules.)
