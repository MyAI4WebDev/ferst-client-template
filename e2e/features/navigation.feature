# Realizes: docs/CLIENT-TEMPLATE-ARCHITECTURE.md · the thin-client contract
@navigation @e2e
Feature: A visitor moves around the site through the main navigation
  As a visitor
  I want to use the top navigation to reach the main pages
  so that the shared skeleton links every seeded page together as deployed

  Scenario: The navigation reaches the About page
    Given the visitor opens the "/" page
    When they follow "About" in the main navigation
    Then they see a level-1 heading "About us"

  Scenario: The navigation reaches the Services page
    Given the visitor opens the "/" page
    When they follow "Services" in the main navigation
    Then they see a level-1 heading "Services"

  Scenario: The navigation reaches the Contact page
    Given the visitor opens the "/" page
    When they follow "Contact" in the main navigation
    Then they see a level-1 heading "Get in touch"
