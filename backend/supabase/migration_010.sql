-- migration_010: investor portfolio cache for scrape-based shared investor matching
-- Replaces Crunchbase API dependency for the investor prospects feature.
-- Sisense's 4 scrapeable investors are hardcoded in investorPortfolioScraper.js.

create table if not exists investor_portfolio_companies (
  id                      uuid primary key default gen_random_uuid(),
  investor_name           text not null,
  company_name            text not null,
  company_name_normalized text not null,
  domain                  text,
  scraped_at              timestamptz not null default now()
);

create index if not exists idx_ipc_name_norm on investor_portfolio_companies(company_name_normalized);
create index if not exists idx_ipc_domain    on investor_portfolio_companies(domain);
create index if not exists idx_ipc_investor  on investor_portfolio_companies(investor_name);
