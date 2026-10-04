# Realizes: docs/CLIENT-TEMPLATE-ARCHITECTURE.md · the thin-client contract
@blog @e2e
Feature: The blog capability renders for a visitor
  As a visitor
  I want to browse the news index and open a post
  so that the ferst()-injected blog routes work end-to-end from a Markdown file

  Scenario: The news index lists the example post
    Given the visitor opens the "/posts" page
    Then they see a level-1 heading "Posts"
    And they see a card titled "Welcome to your new site"

  Scenario: Opening a post shows the post page
    Given the visitor opens the "/posts" page
    When they open the post "Welcome to your new site"
    Then they see a level-1 heading "Welcome to your new site"
    And they can follow the call to action "All posts"

  Scenario: A new site starts with the starter tags, and the example post is filed under News
    Given the visitor opens the "/posts/tag/news" page
    Then they see a level-1 heading "News"
    And they see a card titled "Welcome to your new site"
