### Data Sources

#### Indeed (via SerpAPI)
- Query params: q, l, freshness
- Fields: company, title, location, posted_at

#### LinkedIn (via SerpAPI)
- Query params: keywords, location
- Fields: company, title, location, post_age

#### Craigslist (scrape within ToS)
- Fields: title, location, posted_at

Normalization
- Map all to JobPosting with: source, company, role_title, location, post_age_days
