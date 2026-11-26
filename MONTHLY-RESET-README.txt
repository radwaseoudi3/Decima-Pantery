DECIMA PANTRY - MONTHLY ARCHIVE / RESET

WHAT THIS VERSION ADDS
- Admin Dashboard shows the active reporting batch (for example November 2026).
- Ingredients & Inventory shows "Consumed this batch" for every ingredient.
- Admin gets an "Archive & start new batch" button.
- Reset is blocked while any order is New or Preparing.
- Closing a batch preserves:
  * all order records
  * order count
  * ingredient consumption totals
  * opening inventory snapshot
  * closing inventory snapshot
- A new batch starts with consumption counters at zero.
- Real remaining physical stock carries forward. It is NOT automatically refilled.
- Archived batches are available under Admin > Monthly archive.

ONE-TIME SUPABASE STEP
1. Open Supabase > SQL Editor > New query.
2. Open MONTHLY-ARCHIVE-RESET-PATCH.sql from this folder.
3. Copy all of it into Supabase and click Run.
4. The result should show: MONTHLY_ARCHIVE_RESET_OK
5. Upload this updated site to GitHub Pages.

MONTH-END USE
1. Complete all open orders.
2. Unlock Admin mode.
3. Open Dashboard.
4. Click "Archive & start new batch".
5. Confirm the next batch name.
6. The old batch moves to Monthly archive and the new consumption counter begins at zero.
