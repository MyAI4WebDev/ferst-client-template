# Realizes: docs/CLIENT-TEMPLATE-ARCHITECTURE.md · the thin-client contract
@home @e2e
Feature: The home page renders for a visitor
  As a visitor
  I want the site's home page to open with its hero and call to action
  so that an assembled thin client greets people the moment it is deployed

  Scenario: The home hero opens the page
    Given the visitor opens the "/" page
    Then they see a level-1 heading "Welcome to Your Company"
    And they can follow the call to action "Explore the site"
