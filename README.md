# TRAC Request Backend

Express API for the TRAC student request portal and registrar administration app. It handles authentication, document requests, queue/status workflows, administrative settings, activity logs, email notifications, and uploaded images.

## Requirements

- Node.js 20 or newer and npm 10 or newer are recommended for local development.
- A Supabase project with the application schema configured.
- Resend credentials to send email notifications.
- Cloudflare R2 (or a compatible S3 endpoint) credentials for image uploads.

The API can start without email or R2 configured, but those features will not work. Supabase URL and service-role key are required during startup.

## Dependencies

Runtime packages are installed from `package.json` with `npm install`:

| Package | Purpose |
| --- | --- |
| `express` | HTTP API server |
| `@supabase/supabase-js` | Supabase database access |
| `@aws-sdk/client-s3` | S3-compatible image storage client for Cloudflare R2 |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | API authentication tokens |
| `cors` | Cross-origin request handling |
| `dotenv` | Local environment configuration |
| `multer` | Multipart upload handling |
| `resend` | Transactional email delivery |
| `nodemailer` | Email transport support |
| `framer-motion` | UI-related package currently declared by this package |

`nodemon` is the development dependency used by the `dev` script.

## Configuration

Create a `.env` file in this project directory. Do not commit it or put real keys in documentation, issue reports, or client-side applications.

```dotenv
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@your-verified-domain.example
RESEND_FROM_NAME=TRAC Request
STUDENT_APP_URL=http://localhost:5173
ADMIN_APP_URL=http://localhost:3000
TRAC_LOGO_URL=

R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=your-bucket
R2_PUBLIC_BASE_URL=https://your-public-storage-domain.example
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
```

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key with database privileges required by the API. Never expose it in either frontend. |
| `JWT_SECRET` | Yes for secure authentication | Secret used to sign and verify tokens. Use a unique, high-entropy value in every environment. |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `7d`. |
| `PORT` | No | API port; defaults to `5000`. |
| `CORS_ORIGINS` | No | Comma-separated allowed browser origins. Defaults include local ports `5173`, `3000`, `3002`, and `5000`. Set this to the deployed frontend origins in production. |
| `RESEND_API_KEY` | For email | Resend API key. Without it, email sending and verification are unavailable. |
| `RESEND_FROM_EMAIL` | For email | Sender address verified with Resend. |
| `RESEND_FROM_NAME` | No | Sender display name; defaults to `TRAC Request`. |
| `STUDENT_APP_URL` | Recommended for email | Student app base URL used to build email links. |
| `ADMIN_APP_URL` | Recommended for email | Admin app base URL used to build email links. |
| `TRAC_LOGO_URL` | No | Optional HTTPS logo URL used in email templates. A valid HTTPS `TracLogo.png` under `STUDENT_APP_URL` may be used when this is blank. |
| `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | For image uploads | All five must be configured together to enable image upload and deletion. |
| `NODE_ENV` | No | Set to `production` in production deployments; local-only config loaders read `.env` outside production. |

Generate a strong JWT secret locally, for example with `openssl rand -hex 32`. Supply production values through the hosting provider's secret/environment settings rather than a committed file.

## Create the First Admin

The API does not create a default administrator account. Create the first admin explicitly with a unique password:

1. Set `ADMIN_INITIAL_PASSWORD` in your local shell environment without adding it to source control.
2. Run `node generate-hash.js` from this project directory. The script prints a bcrypt hash and example SQL; it does not print the password.
3. Review and run the generated insert statement in the Supabase SQL Editor, then remove `ADMIN_INITIAL_PASSWORD` from the shell environment.

Do not restore an automatic or hard-coded default admin password.

## Supabase Setup

1. Create or select the Supabase project used by the application and obtain its project URL and server-side service-role key.
2. Create the database schema and base tables expected by the API before applying the repository migrations. These migration files alter existing `public.requests`, `public.users`, `public.admins`, and/or `public.system_settings` tables; they do not create the complete application schema.
3. Back up the affected tables before applying migrations to a database containing data. Review each SQL file and run it in the Supabase SQL Editor or through your normal migration process.
4. Apply the catalog migrations when enabling admin-managed academic programs, document settings, and request fee snapshots:
   - `supabase/academic-catalog.sql` adds/defaults `academic_settings`.
   - `supabase/request-catalog-authority.sql` persists catalog terms and enforces request catalog limits; it also touches settings/catalog data.
  - `supabase/trac-contact-email.sql` updates the known MSU-TCTO registrar contact address to `registrar@trac.edu.ph` in existing settings.
5. Apply `supabase/profile-avatar.sql` to add avatar fields when using profile image uploads.
6. Apply `supabase/or-fifo-migration.sql` for the official-receipt review workflow. Apply `supabase/or-submission-history.sql` after it, because the history migration uses the OR fields added to `public.requests`.

Migrations should be reviewed against the live schema and the feature version being deployed. Avoid applying migrations blindly to production.

## Install and Run

```bash
npm install
npm run dev
```

The development server starts at `http://localhost:5000` by default and uses the `Asia/Manila` timezone. The backend can be tested with `npm test`.

Run the frontends in separate terminals and point both at this API:

```dotenv
# Student app .env
VITE_API_URL=http://localhost:5000/api

# Admin app .env
VITE_API_URL=http://localhost:5000/api
```

## API Route Groups

All API routes are mounted under `/api`:

| Path | Responsibility |
| --- | --- |
| `/api/auth` | Student authentication and account flows |
| `/api/admin` | Admin authentication, user management, and settings |
| `/api/requests` | Student requests, request details, and dashboard statistics |
| `/api/queue` | Queue operations and serving order |
| `/api/update-status` | Request status updates |
| `/api/email-logs` | Email delivery logs |
| `/api/activity-logs` | Administrative activity logs |
| `/api/public/settings` | Public settings used by the student app |
| `/api/test` | Development/testing routes; review access controls before production exposure |

## Project Layout

```text
src/
  app.js                 Express middleware and route mounting
  server.js              Server startup and port configuration
  config/                Supabase, JWT, and email configuration
  controllers/           API request handlers
  middleware/            Authentication and upload middleware
  routes/                Express route definitions
  services/              Email and object-storage integrations
  utils/                 Catalog, email template, and hashing helpers
supabase/                SQL migrations for application features
```

## Production Notes

- Keep the Supabase service-role key, JWT secret, Resend key, and R2 credentials on the server only.
- Configure `CORS_ORIGINS` with the exact deployed student and admin origins.
- Set the app URLs and verified email sender for the production domains.
- Configure all R2 variables together and ensure the public base URL serves uploaded objects if the UI must display them.
- The app listens on `PORT` or `5000`; configure the deployment platform to provide its assigned port.#   t r a c _ b a c k e n d 
 
 