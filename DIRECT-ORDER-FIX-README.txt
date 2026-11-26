DECIMA PANTRY - DIRECT SUPABASE ORDER FIX

1. In Supabase > SQL Editor > New query, run DIRECT-SUPABASE-ORDER-PATCH.sql once.
2. Confirm the result row says DIRECT_ORDER_PATCH_OK and anon_can_insert = true.
3. Replace the files in the GitHub Pages repository with the files in this package.
4. Test one employee order, then sign in to the Staff/Barista screen and confirm it appears.

This build no longer uses the public place_pantry_order RPC for employee submissions.
The employee browser may insert a new order only; it cannot read the shared order queue.
Inventory validation/deduction happens in a protected Supabase trigger.
