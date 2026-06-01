-- Local-only leaderboard seed.
-- Populates the `scans` table with curated, well-known Shopify/Hydrogen
-- storefronts and plausible (illustrative, not real) scores so the local
-- /leaderboard renders during development.
--
-- Apply with:
--   wrangler d1 execute zephyr --local --file scripts/seed-local.sql
--
-- Grades follow the scoring rubric: A>=90, B>=75, C>=60, D>=40, F<40.
-- scanned_at values are kept recent so they fall within the 7d/30d windows.

DELETE FROM scans WHERE id LIKE 'seed-%';

INSERT INTO scans
  (id, domain, target_url, overall, grade,
   category_commerce, category_product_data, category_checkout,
   category_discoverability, category_content, scanned_at, hidden)
VALUES
  ('seed-skims',        'skims.com',            'https://skims.com/',            94, 'A', 90, 96, 98, 95, 92, '2026-05-30T09:12:00.000Z', 0),
  ('seed-glossier',     'glossier.com',         'https://glossier.com/',         92, 'A', 88, 95, 96, 93, 90, '2026-05-30T11:30:00.000Z', 0),
  ('seed-allbirds',     'allbirds.com',         'https://allbirds.com/',         91, 'A', 86, 94, 95, 92, 90, '2026-05-29T08:05:00.000Z', 0),
  ('seed-gymshark',     'gymshark.com',         'https://gymshark.com/',         88, 'B', 82, 90, 94, 88, 84, '2026-05-29T14:48:00.000Z', 0),
  ('seed-rothys',       'rothys.com',           'https://rothys.com/',           84, 'B', 78, 88, 90, 84, 80, '2026-05-28T10:20:00.000Z', 0),
  ('seed-brooklinen',   'brooklinen.com',       'https://brooklinen.com/',       82, 'B', 76, 86, 88, 82, 78, '2026-05-28T16:00:00.000Z', 0),
  ('seed-vuori',        'vuoriclothing.com',    'https://vuoriclothing.com/',    79, 'B', 72, 84, 86, 78, 76, '2026-05-27T12:10:00.000Z', 0),
  ('seed-mejuri',       'mejuri.com',           'https://mejuri.com/',           77, 'B', 70, 82, 84, 76, 74, '2026-05-27T19:25:00.000Z', 0),
  ('seed-ruggable',     'ruggable.com',         'https://ruggable.com/',         73, 'C', 66, 78, 80, 72, 70, '2026-05-26T09:40:00.000Z', 0),
  ('seed-bombas',       'bombas.com',           'https://bombas.com/',           68, 'C', 60, 74, 76, 68, 64, '2026-05-26T13:55:00.000Z', 0),
  ('seed-caraway',      'caraway.com',          'https://caraway.com/',          64, 'C', 56, 70, 72, 64, 60, '2026-05-25T10:05:00.000Z', 0),
  ('seed-magicspoon',   'magicspoon.com',       'https://magicspoon.com/',       61, 'C', 52, 68, 70, 62, 56, '2026-05-25T17:30:00.000Z', 0),
  ('seed-liquiddeath',  'liquiddeath.com',      'https://liquiddeath.com/',      57, 'D', 48, 64, 66, 58, 52, '2026-05-24T11:15:00.000Z', 0),
  ('seed-drsquatch',    'drsquatch.com',        'https://drsquatch.com/',        49, 'D', 40, 56, 58, 50, 44, '2026-05-23T15:45:00.000Z', 0),
  ('seed-colourpop',    'colourpop.com',        'https://colourpop.com/',        44, 'D', 34, 52, 54, 44, 38, '2026-05-22T09:00:00.000Z', 0),
  ('seed-fashionnova',  'fashionnova.com',      'https://fashionnova.com/',      36, 'F', 26, 44, 46, 36, 30, '2026-05-21T18:20:00.000Z', 0);
