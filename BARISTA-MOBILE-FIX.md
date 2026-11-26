# Barista mobile fix

This build fixes the mobile-side behavior in the pantry app:

- The Barista login is kept on the dedicated Barista phone after refresh/reopen.
- The Barista queue refreshes immediately when the phone returns to the foreground or reconnects to the internet.
- Arabic Barista order cards and action buttons are optimized for touch screens.
- A hosted production copy no longer pretends an order was sent when shared database mode is off.
- The Barista screen clearly shows whether cross-device shared orders are connected.

## Important: the shared database must be connected

GitHub Pages is a static website. Different phones cannot share browser `localStorage` with each other. For employee phones to send orders to the Barista phone, the app must use the shared Supabase database already supported by this project.

The website code is ready for that connection. `cloud-config.js` currently still contains placeholder values and `enabled: false`, so the shared database is not yet active.

Once a Supabase project is connected, no employee login is required. Employees submit orders normally, while the Barista/Admin accounts authenticate to see and manage the shared queue.

Use `SUPABASE-SETUP.sql` for the database setup and then place the project's URL and anon/publishable key in `cloud-config.js`.
