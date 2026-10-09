# Realizes: ferst-core 0.8.0's search signals (lib/seo.mjs, the ferst() integration): a test
#   copy keeps itself out of search results, and every page names its canonical address on
#   the live domain (ferst-site.json `siteUrl`, here FERST_SITE_URL).
# Vision: only the live site ranks, at one address per page; a test copy never competes with
#   it (the platform's SEO epic).
@search @e2e
Feature: A site tells search engines what to index
  As the team running a client's site
  I want test copies kept out of search results, and every page to name its real address
  so that only the live site ranks, at one address per page

  # playwright.config.ts builds the template as a test copy (CF_PAGES_BRANCH=dev) of
  # https://example.org.
  Scenario: A test copy asks search engines not to index it
    Given the visitor opens the "/" page
    Then the page asks search engines not to index it
    And robots.txt still lets search engines crawl the site, so they see that
    And the build marks every file noindex for Cloudflare, PDFs included

  Scenario: Every page names its address on the live site
    Given the visitor opens the "/" page
    Then its canonical address is "https://example.org/"

  # Without a 404 page, Cloudflare Pages answers a missing address with the home page and a
  # 200 (a "soft 404"): search engines index the home page under every dead address.
  Scenario: A missing address answers "page not found", not the home page
    When the visitor opens an address the site doesn't have
    Then the answer is a 404
    And the page says it isn't here, with a way back to the home page
    And it names no canonical address
