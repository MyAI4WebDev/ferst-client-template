# Realizes: docs/CLIENT-TEMPLATE-ARCHITECTURE.md · the thin-client contract — the cookie
#   banner's policy link opens a real policy on every site, with no page file in the repo
#   (ferst() injects /cookie-policy from the blocks the site actually uses; ferst-core #9).
@cookie-policy @e2e
Feature: Every site has a cookie policy behind its cookie banner
  As a visitor
  I want the cookie banner's policy link to open the site's cookie policy
  so that I can see what is stored before I choose

  Scenario: The banner's policy link opens the cookie policy
    Given the visitor opens the "/" page
    When they follow the cookie banner's policy link
    Then they see a level-1 heading "Cookie Policy"
    And the policy lists the storage the site needs
