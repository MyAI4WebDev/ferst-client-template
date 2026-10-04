# Realizes: the thin-client contract — a site's own fonts load (ferst-core ships them,
#   ferst() serves and copies them; 0.7.6). Without them every site falls back to system fonts.
@fonts @e2e
Feature: The site's fonts load
  As a visitor
  I want text in the site's own typeface
  so that the brand looks as it was designed

  Scenario: The engine's fonts are served with the site
    Given the visitor opens the "/" page
    Then the font file "inter-latin-400-normal.woff2" is served
