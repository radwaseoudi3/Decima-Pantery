# Decima Pantry

Mobile-first office pantry ordering app. Runs directly from `index.html` with VS Code Live Server and can be hosted on GitHub Pages.

## Employee flow

1. Choose a drink.
2. Choose the delivery location.
3. If **Main Hall** is selected, choose the exact desk from the visual workstation map.
4. Choose quantity and sugar (1 spoon = **5 g**) or use **Custom Request**.
5. Submit.

The default landing page is always the employee ordering page for a new unsigned-in tab.

## Barista

The Barista interface is in Arabic. Drink names and delivery locations are shown in Arabic. A coffee-shop counter bell repeats while any order is still **New** and stops for an order when the Barista clicks **تم استلام الطلب**.

## Admin

Admin can add/edit/delete:

- ingredients and inventory
- bilingual drinks (English employee name + Arabic Barista name)
- recipes
- bilingual locations (English employee name + Arabic Barista name)

Admin can also enable the workstation desk map on a location.

## Important: multiple phones/computers

Browser `localStorage` cannot share data between an employee phone and a separate Barista computer. This version includes a shared Supabase data layer specifically to solve that.

Follow `SHARED-DATABASE-SETUP.md` before office-wide GitHub Pages use.

## Local demo login (when cloud-config.js has enabled:false)

- Barista: `barista` / `Coffee123!`
- Admin: `admin` / `Decima123!`

When shared database mode is enabled, the passwords come from the two Supabase Auth users instead of being stored in the website code.

## Main Hall visual delivery map
For orders delivered to the Main Hall, the Barista/Admin order card now shows a compact visual copy of the desk layout. The employee's selected desk is highlighted in Decima burgundy, so the Barista can locate the delivery point visually instead of relying on the desk code alone.

## Custom delivery location
Employees now choose delivery locations from tap-friendly cards. A final **Custom Location** card opens a text field for any unlisted location. Custom locations are displayed to the Barista as `موقع مخصص: <entered location>`.

## Barista mobile reliability fix

The current build keeps the Barista session across mobile reloads, refreshes shared orders when the phone returns to the foreground/online, improves touch targets, and prevents hosted local-only orders from being falsely reported as sent. See `BARISTA-MOBILE-FIX.md`.

## Monthly consumption archive
This build adds Admin-only reporting batches. Run `MONTHLY-ARCHIVE-RESET-PATCH.sql` once in Supabase. The Dashboard then shows current-batch ingredient consumption, an **Archive & start new batch** control, and a **Monthly archive** tab. Closing a batch preserves orders and inventory snapshots, resets reporting consumption to zero, and carries the real remaining stock into the new batch.
