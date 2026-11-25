# Church event registration

A one-page event website and an organizer dashboard at `/admin`. The website uses React, TypeScript, and Vite. Supabase handles registration storage, organizer authentication, and attendance totals.

## Run locally

Use Node.js 20.19+ or 22.12+. From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

The terminal shows the local site URL. The page and gallery work without Supabase. Saving a registration or signing in requires a configured Supabase instance.

## Connect Supabase

1. For local development, start Docker. Create the loopback network once, then start Supabase in this directory. This project's local API uses port 55321.

   ```powershell
   docker network create --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 church_event_registration_loopback
   supabase start --network-id church_event_registration_loopback
   ```

   Check the published addresses with `docker ps --filter "name=church_event_registration"`. The Windows Docker Desktop setup used for this build published the API and database on all interfaces despite the bridge setting. If you see `0.0.0.0` or `[::]` beside the project ports, use `supabase stop` to stop the local project and preserve its data.

   For a hosted project, link it with the Supabase CLI and apply this repository's migrations with `supabase db push`. [Supabase local development guide](https://supabase.com/docs/guides/local-development)
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the API URL and publishable key for that instance. The client also accepts `VITE_SUPABASE_ANON_KEY` for an instance with a legacy anon key. Restart the dev server after changing these values.
3. Create an organizer's user account in Supabase Authentication. Copy the user ID and run this SQL as the database owner:

   ```sql
   insert into event_private.event_organizers (user_id)
   values ('<organizer-auth-user-uuid>')
   on conflict do nothing;
   ```

4. Sign in at `/admin` with that account. The dashboard shows database totals and activity. Use search and dates to narrow the attendee list, then export the matching records as an Excel-compatible CSV.

The front end needs only the publishable key. The submission RPC validates and saves registrations in the database, including idempotent retries. The database computes each party's size, and row-level policies limit access to attendee records to authorized organizers.

## Update event information

All page content is in one place: [public/event-content/event.json](public/event-content/event.json). Open the `public/event-content` folder and edit that file. Replace values on the right side of each `:` while keeping the quoted text, commas, and property names in place. For example, change `"churchName": "[CHURCH NAME]"` to `"churchName": "Grace Church"`.

Save the file and refresh the page to see your edits. The same event details are reused in the header, hero, date and time, activities, registration form, location, footer, and organizer dashboard. The `START HERE.txt` file in that folder gives a short reminder.

Put the church logo and event photos in `public/event-content/images`. In `event.json`, set `logoUrl` or a photo's `src` to the matching web path, such as `/event-content/images/logo.png`. Add a short description in the photo's `alt` field. A photo with `"src": null` keeps its placeholder. Only use the Instagram and Facebook keys already listed under `socialLinks`.

Check the event end date and time before publishing; the countdown uses `endsAt` and the selected `timezone`. On a live website, upload the changed `event.json` and image files to the same paths, then refresh. Rebuild the app as well when changing the page title or social sharing image.

`npm.cmd run build` type-checks the app and creates the deployable `dist/` folder. Use an HTTPS host and configure its SPA fallback so opening `/admin` directly resolves to `index.html`. Set the production Supabase environment variables at build time.

To run the transactional database checks against a configured test database, use `psql "<test-database-url>" -f supabase/checks/registration.sql`.
