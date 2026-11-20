# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through GitHub: go to the repository's **Security** tab and click **Report a vulnerability**, or use [this link](https://github.com/legend0x01/habit-tracker/security/advisories/new).

Please include:

- what the issue is and what an attacker could do with it
- steps to reproduce
- any suggested fix

You'll get a reply as soon as possible, and credit in the fix if you'd like it.

## Scope

In scope:

- the app code in this repository (`index.html`, `support.html`, `config.js`)
- the database schema and row-level security policies in `supabase/schema.sql`
- the hosted app at https://legend0x01.github.io/habit-tracker/

Out of scope: vulnerabilities in Supabase, Google or GitHub themselves (report those to the vendor), and attacks that need physical access to a user's unlocked device.

## Notes on keys

`config.js` contains the Supabase **publishable** key. It is designed to be public: access to data is enforced by row-level security, so it is not a vulnerability by itself. A way to read or change **another user's** data would be.
