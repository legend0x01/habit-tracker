# Contributing to Habit Tracker

Thanks for your interest in improving Habit Tracker! Bug reports, ideas and pull requests are all welcome.

## Ways to help

- **Report a bug**: [open a bug report](https://github.com/legend0x01/habit-tracker/issues/new?template=bug_report.yml) with steps to reproduce.
- **Suggest a feature**: [open a feature request](https://github.com/legend0x01/habit-tracker/issues/new?template=feature_request.yml). Check the [roadmap](README.md#-roadmap) first.
- **Send a pull request**: fixes, features, docs and accessibility improvements.

## Local setup

There is no build step and nothing to install.

```bash
git clone https://github.com/<your-username>/habit-tracker.git
cd habit-tracker
python -m http.server 3000      # or: npx serve -l 3000 .
```

Open <http://localhost:3000>.

- For **local-only mode** (no sign-in needed, covers most UI work), set `supabaseUrl` in `config.js` to `"https://YOUR_PROJECT_REF.supabase.co"` and don't commit that change.
- To work on sign-in or sync, create your own free Supabase project by following [Self-host it](README.md#-self-host-it). Don't commit your own keys.

## Pull request guidelines

1. **Fork** the repo and create a branch from `main`: `git checkout -b fix/streak-count`.
2. Keep the project **dependency-free**: vanilla HTML, CSS and JavaScript, no frameworks or build tools.
3. Match the existing code style: compact functions, the `--` CSS colour tokens in `:root`, and HTML built with template strings. **Always escape user text with `esc()`.**
4. Test in a desktop browser **and** at phone width (about 390 px), in local-only mode and, if you touched sync, signed in.
5. Don't change `config.js` values or the Supabase schema unless the PR is about them. Schema changes must be safe to re-run.
6. Write a clear PR description: what changed, why, and screenshots for UI changes.

## Commit messages

Use short, imperative subjects, for example:

```
Add CSV export for the annual dashboard
Fix streak reset when a month has no goal
```

## Code of conduct

Please read and follow the [Code of Conduct](CODE_OF_CONDUCT.md). In short: be kind and respectful.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
