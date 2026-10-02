# Rebuilding an existing website from a URL

This is done by the **`migrate-site` skill**, which ships in this repo and is picked up
automatically by Claude Code (including Claude Code on the web):

- `.claude/skills/migrate-site/SKILL.md`: the step-by-step playbook.
- `.claude/skills/migrate-site/reference.md`: the rules, the section-to-block map and the report template.
- `.claude/skills/migrate-site/scripts/snapshot.mjs`: freezes the old site into a git-ignored
  `.migration/` folder (pages, text, media, `inventory.json`).
- `.claude/skills/migrate-site/scripts/coverage.mjs`: checks that every old page is accounted for
  and that its text made it across.
- `.claude/agents/`: **site-inventory** (plans every old URL), **page-builder** (builds
  pages and posts, run in parallel) and **migration-auditor** (build, coverage, `MIGRATION-REPORT.md`).

To run it, open this repo in Claude Code and ask, for example:

> Rebuild the website at https://example.org in this repo using the migrate-site skill.

It works on a branch, opens a pull request, and lists everything the current blocks can't
build in the **Undeliverable** section of `MIGRATION-REPORT.md`. It never writes code to fill a gap.

**Before you start (cloud sessions):** make sure the environment's network access allows
the old site's domain, or the snapshot can't fetch it.
