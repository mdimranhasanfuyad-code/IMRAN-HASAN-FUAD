# Security Spec for Speech Mastery Pro

## Data Invariants
1. Only authenticated users in the `admins` collection can perform write operations on `members`, `attendance`, `fines`, and `admins`.
2. Attendance records must have a score between 0 and 10 for speakers, or exactly 3 for listeners/rest-day attendance.
3. Member scores and fines are updated via atomic operations or consistent states.
4. Timestamps (`createdAt`, `updatedAt`) must be server-generated.
5. All document IDs must be validated to prevent resource poisoning.

## The "Dirty Dozen" Payloads (Anti-Tests)
1. **P1 (Identity Spoofing)**: A guest user attempts to create a new Member document. Expect: `PERMISSION_DENIED`.
2. **P2 (Identity Spoofing)**: A signed-in non-admin user attempts to delete another member. Expect: `PERMISSION_DENIED`.
3. **P3 (Privilege Escalation)**: A non-admin user attempts to add their UID to the `admins` collection. Expect: `PERMISSION_DENIED`.
4. **P4 (Resource Poisoning)**: An admin attempts to create a member with a document ID that is a 2MB string. Expect: `PERMISSION_DENIED`.
5. **P5 (Schema Violation)**: An admin attempts to create a member with a "shadow field" `isAdmin: true`. Expect: `PERMISSION_DENIED`.
6. **P6 (Integrity Violation)**: An admin attempts to update a member's `totalScore` by 1000 in one go (ignoring session rules). Expect: `PERMISSION_DENIED` (if we enforce state transitions, though here it's more about hasOnly).
7. **P7 (Temporal Violation)**: An admin attempts to set `createdAt` to a date in the past. Expect: `PERMISSION_DENIED`.
8. **P8 (State Shortcutting)**: An admin attempts to mark a "paid" fine back to "due" without proper audit. (Note: Simple rules might allow this, but we'll try to restrict).
9. **P9 (Value Poisoning)**: An admin attempts to set a speaker's score to 11. Expect: `PERMISSION_DENIED`.
10. **P10 (Immortal Field)**: An admin attempts to change the `memberId` field inside an existing `attendance` record. Expect: `PERMISSION_DENIED`.
11. **P11 (Query Scraping)**: A user attempts to list all `admins` emails. Expect: `PERMISSION_DENIED` (unless explicitly allowed for profile display).
12. **P12 (Relational Orphan)**: An admin attempts to create an attendance record for a `memberId` that does not exist. Expect: `PERMISSION_DENIED`.

## Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| members | blocked (admin only) | blocked (admin only) | blocked (isValidId) |
| attendance | blocked (admin only) | blocked (admin only) | blocked (isValidId) |
| fines | blocked (admin only) | blocked (admin only) | blocked (isValidId) |
| admins | blocked (root admin) | blocked (root admin) | blocked (isValidId) |
