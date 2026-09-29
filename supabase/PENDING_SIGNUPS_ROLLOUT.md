# Pending Signup Rollout

1. Compare `pending-signups.sql` with the live `public.users` schema, especially the profile, verification, and password columns used by `verify_and_promote_pending_signup`.
2. Back up the database, then apply `pending-signups.sql` before deploying the backend code. The functions are executable only by `service_role`; the pending table has RLS enabled and no client-role access.
3. Review the unverified-account count from `pending-signups-legacy-cleanup.sql`. Existing unverified rows block a restart for the same email or ID number. Back up and confirm the exact affected records before manually uncommenting and running its delete statement. The cleanup is deliberately not part of the migration.
4. Configure `JWT_SECRET` consistently across the backend instances. Pending OTP hashes are keyed with this secret; rotating it invalidates outstanding codes, which users can replace by requesting a resend.
5. Deploy the backend and student app together, then test signup, password-proven retry, login recovery, resend cooldown and hourly limit, email delivery failure, code expiry/attempt limit, successful promotion, and subsequent login.
6. Run backend checks with `npm test` and build the student app with `npm run build` from `TRAC-student`.

The repository does not contain the base `public.users` DDL, so SQL type and constraint compatibility must be validated against the deployed project before rollout. Do not apply the legacy deletion statement without an explicit backup and affected-row review.
