# Realizes: the migrate-site skill's URL map (.claude/skills/migrate-site/scripts/urlmap.mjs,
#   urls.mjs, check-urls.mjs): every old address that still works is kept, redirected in one
#   step, or dropped with a reason, and the record stays in the site's repo.
# Vision: a migration keeps the old site's search rankings while the new site is free to be
#   better (the platform's migration assessment).
@migration @e2e
Feature: Every old address of a migrated site is accounted for
  As the team moving a site onto Ferst
  I want a record of every old address and what became of it
  so that nothing that still brings visitors breaks when the domain moves

  Scenario: An address found in several places is one row, with its traffic
    Given the snapshot found "/clergy/" and "/wp-content/uploads/2024/01/news.pdf"
    And the Wayback Machine knows "/clergy", "/wp-admin/" and "/old-page/"
    And Search Console reports 12 clicks for "https://example.org/clergy/"
    When the URL map is built
    Then it has 3 addresses
    And "/clergy/" was found by "search-console;snapshot;wayback" with 12 clicks
    And "/wp-content/uploads/2024/01/news.pdf" is media

  Scenario: An address the old site serves at its trailing-slash form is live there
    When the old site answers "/clergy" with a redirect to "/clergy/"
    Then the address is live as "/clergy/"

  Scenario: Re-running keeps the decisions already made
    Given the map already says "/contacts/" redirects to "/contact/"
    When the Wayback Machine finds "/contacts" again
    Then "/contacts/" still redirects to "/contact/"

  Scenario: A redirect that takes two steps is flagged
    Given "/contact/" is redirected to "/contacts/"
    When the new site answers 301, then 308, then 200 at "/contacts/"
    Then the check fails with "a redirect chain"

  Scenario: A kept page behind Cloudflare's trailing-slash step passes
    Given "/clergy" is kept
    When the new site answers 308, then 200 at "/clergy/"
    Then the check passes

  Scenario: A live address with no decision, or a redirect with no rule, is flagged
    Given a live address "/rcia/" with no decision
    And "/enquiries/" is redirected to "/contacts/" with no rule in _redirects
    Then the static check reports "not decided" and "no rule in public/_redirects"
