# Realizes: docs/CLIENT-TEMPLATE-ARCHITECTURE.md · the thin-client contract
@content-page @e2e
Feature: A content page renders from its JSON blocks
  As a visitor
  I want a content page to show its heading and content
  so that a page authored as block-JSON data reaches me as a real, correct page

  Scenario: The About page renders its blocks from JSON
    Given the visitor opens the "/about" page
    Then they see a level-1 heading "About us"
    And they read a paragraph containing "everyone deserves a website"
    And they see a level-2 heading "What we value"
    And they see a card titled "People first"
