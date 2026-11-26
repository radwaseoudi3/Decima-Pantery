/*
  Shared database configuration.
  Leave enabled:false for local-only Live Server testing.
  For real cross-device orders on GitHub Pages, follow SHARED-DATABASE-SETUP.md,
  then paste your Supabase project URL + anon key below and set enabled:true.
*/
window.DECIMA_PANTRY_CLOUD = {
  enabled: false,
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-SUPABASE-ANON-KEY',
  adminEmail: 'pantry-admin@decimaintl.com',
  baristaEmail: 'pantry-barista@decimaintl.com',
  pollMs: 2000
};
