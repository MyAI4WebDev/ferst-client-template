---
name: nightly
description: The scheduled overnight run for this site. Checks the overnight update landed, then works this site's open issues in order. Use only when a scheduled run tells you to.
---

# Overnight: update first, then issues

You run at night with nobody to ask. The site's people and the core team read what you
leave in the morning, so say plainly what you did and what you couldn't. Everything you do
lands on `dev`, the **test copy**. The live site (`main`) changes only when a person
releases the test copy after checking it.

`CLAUDE.md` applies in full. Use `gh api` (REST) for GitHub: GraphQL, and with it
`gh issue list` and `gh pr create`, is blocked in these sessions. The commands are at the end.

## 1. Update first

The `update` Action runs at 23:43 UTC and has normally brought `dev` current already (GitHub
sometimes starts it late, so check).
- Name this repository in every GitHub call: `repos/<repo>/…`, where `<repo>` is the name in
  `git remote get-url origin` (for example `MyAI4WebDev/ctk_parish_eastbourne`). Don't use
  `gh repo set-default`: it needs GraphQL. Naming the repository also keeps `gh` off the
  public template, which an update adds as a git remote.
- Start from `dev`: `git checkout dev && git pull`.
- If an `update-failed` issue is open, handle it first (section 2).
- If `.github/workflows/update.yml` is missing (the site predates it), or
  `npm run update -- --dry-run` still shows changes, do CLAUDE.md's Step 0 yourself:
  `npm ci && npm run update`. When it finishes green, commit (`chore(update): …`) and push
  to `dev`. That push deploys the test copy.
- If no issues are open, you're done (section 5).

## 2. Then the issues, oldest first, by kind

1. **`update-failed`:** the overnight update broke the build or the check. Read the run it
   links to.
   - If this site's content is the cause (for example a page the new engine rejects), fix it
     on `dev` with the gate green, push, comment what you fixed, and close the issue.
   - If the engine or the template is the cause, open a `core-request` with the error
     (CLAUDE.md), and leave the issue open.
2. **`core-update`:** the core team's release tasks. Do the remaining tasks on `dev`, tick the
   boxes, push, comment what you did, and close the issue.
3. **`client-request`:** a request from the site's editors. Make the change on a branch and
   open a PR into `dev`: the core team reviews every editor's request before it reaches the
   test copy, so never push one straight to `dev`. Comment on the issue as CLAUDE.md says
   (plain words, no PR link, nothing about how it was done), and leave the issue open. When a
   later night finds that PR merged, comment where to see the change on the test copy, then
   close the issue. Skip a request that already has an open PR.
   - If the engine would have to change, open a `core-request` in this repo, mention it on
     the editor's issue, and leave that issue open.

**Unclear, or not possible with the blocks?** Comment your question or the closest option,
leave the issue open, and move on (CLAUDE.md). Never write code to fill a gap.

`core-request` issues are the core team's to answer. Only read their replies, and act on a
task they give you.

## 3. One issue at a time

Finish each issue completely, with `npm run build` and `npm run check:thin` green, before
you start the next. Comment and close as you go: if the run stops part-way, the next night
carries on with whatever is still open.

## 4. Never

- Push to `main`, open a PR into `main`, or merge anything.
- Edit `themeSettings`: the portal owns the design tokens.
- Touch another repository, or comment outside this one.
- Write code, or handle secrets.

## 5. Report

End with one short line per issue: done (and where to see it), PR opened, or left open (and
why). Then the ferst-core and template versions now on `dev`.

## REST commands

`<repo>` is this repository's name (section 1): write it out in every command.
- Open issues with a label, oldest first (skip entries that have a `pull_request` key):
  `gh api "repos/<repo>/issues?labels=client-request&state=open&sort=created&direction=asc"`
- Comment: `gh api repos/<repo>/issues/<n>/comments -F body=@comment.md`
- Close: `gh api -X PATCH repos/<repo>/issues/<n> -f state=closed`
- Open PRs: `gh api "repos/<repo>/pulls?state=open"`
- Open a PR into `dev`:
  `gh api repos/<repo>/pulls -f title="<title>" -f head="<branch>" -f base=dev -F body=@pr.md`.
  Start the body with `Opened by the nightly run.` and `Refs #<n>`.
- Whether a PR was merged: `gh api repos/<repo>/pulls/<pr> --jq .merged`
