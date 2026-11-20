// Supabase settings (Project Settings → API in your Supabase dashboard).
//
// The anon / publishable key is designed to be public and is safe to commit:
// the row-level-security policies in supabase/schema.sql are what keep each
// user's data private. NEVER put the service_role / secret key here.
//
// Leave the placeholders as they are to run the tracker in local-only mode
// (data saved in the browser, no sign-in).
window.HABIT_CONFIG = {
  supabaseUrl: "https://tmllonrprlxcmbduipjo.supabase.co",
  supabaseAnonKey: "sb_publishable_J3U0CrrUnVlVXCnfcrBdRQ_inmJTe-d",

  // "Buy me a coffee" via UPI (support.html). Leave upiId empty to hide the button.
  // Accepts a plain UPI ID (name@bank) or the same ID base64-encoded (keeps it out of plain-text scrapers).
  upiId: "dHJhZGVyYWJoaW5hdjY5OS0yQG9rc2Jp",
  upiName: "legend0x01",
};
