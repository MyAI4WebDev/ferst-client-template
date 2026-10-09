# Realizes: ferst-core 0.8.1's browser icon (lib/site-icon.mjs): /favicon.ico and
#   /apple-touch-icon.png in every build, from the icon set in the CMS, a roughly square
#   logo, or the site's initial in its brand colour, and linked from every page.
# Vision: a site looks finished in a browser tab and on a phone's home screen, and a
#   migrated site's old /favicon.ico address keeps working.
@chrome @e2e
Feature: Every site has a browser icon
  As a visitor
  I want the site's own icon in my browser tab and on my phone's home screen
  so that I can find it among my tabs and bookmarks

  # The template has no logo, so its icon is its initial on its brand colour.
  Scenario: Every page names its icons, and both icon files answer
    Given the visitor opens the "/" page
    Then the page names its browser icon and its home-screen icon
    And "/favicon.ico" answers with an icon
    And "/apple-touch-icon.png" answers with a 180-pixel image
