-- SAMPLE CONTENT for local development and design review only.
-- Do not run against production once Angel's real work is in.
-- Local:  npx wrangler d1 execute DB --local --file=seed/sample.sql   (see README)

DELETE FROM tasks;
DELETE FROM project_updates;
DELETE FROM deliverables;
DELETE FROM milestones;
DELETE FROM project_media;
DELETE FROM projects;
DELETE FROM services;
DELETE FROM messages;

INSERT INTO projects (id, slug, title, category, summary, body, year, client, role, tags, cover_url, featured, published, position) VALUES
 (1, 'northlight-identity', 'Northlight Identity', 'brand', 'A warm, modular identity system for a coastal coffee roaster.', 'Placeholder case study.

A full identity: wordmark, packaging, signage and a flexible illustration kit.', '2025', 'Northlight Coffee', 'Art direction', 'Identity,Packaging', '/assets/placeholder/p1.svg', 1, 1, 1),
 (2, 'atlas-dashboard', 'Atlas Dashboard', 'development', 'A fast, accessible analytics dashboard built without a framework.', 'Placeholder case study.

Vanilla JS, a small design system and a focus on loading speed.', '2025', 'Atlas Labs', 'Design and front-end', 'Web,Dashboard', '/assets/placeholder/p2.svg', 1, 1, 2),
 (3, 'ember-campaign', 'Ember Campaign', 'brand', 'Launch campaign across social, print and out-of-home.', 'Placeholder case study.

Concept, visual language and rollout assets for a seasonal launch.', '2024', 'Ember Spirits', 'Creative direction', 'Campaign,Print', '/assets/placeholder/p3.svg', 1, 1, 3),
 (4, 'fieldnotes-app', 'Fieldnotes App', 'design', 'Interface design for a note-taking app for naturalists.', 'Placeholder case study.

Research, flows, and a calm high-contrast interface.', '2024', 'Fieldnotes', 'Product design', 'UI,Mobile', '/assets/placeholder/p4.svg', 0, 1, 4),
 (5, 'prism-editorial', 'Prism Editorial', 'design', 'An editorial layout system for a quarterly arts magazine.', 'Placeholder case study.

Grids, type pairings and a set of reusable page templates.', '2023', 'Prism Quarterly', 'Layout and typography', 'Editorial,Print', '/assets/placeholder/p5.svg', 0, 1, 5),
 (6, 'monochrome-site', 'Monochrome Studio Site', 'development', 'A portfolio site for an architecture studio.', 'Placeholder case study.

Image-led layouts and a lightweight CMS-free build.', '2023', 'Monochrome Architects', 'Design and development', 'Web,Portfolio', '/assets/placeholder/p6.svg', 0, 1, 6);

INSERT INTO project_media (project_id, kind, url, caption, position)
SELECT p.id, 'image', p.cover_url, 'Placeholder image', 0 FROM projects p;
INSERT INTO project_media (project_id, kind, url, caption, position)
SELECT p.id, 'image', '/assets/placeholder/p' || ((p.id % 6) + 1) || '.svg', 'Detail', 1 FROM projects p;
INSERT INTO project_media (project_id, kind, url, caption, position)
SELECT p.id, 'image', '/assets/placeholder/p' || (((p.id + 2) % 6) + 1) || '.svg', '', 2 FROM projects p;

INSERT INTO services (title, description, details, published, position) VALUES
 ('Brand identity', 'Logos, visual systems and guidelines that scale across every touchpoint.', 'Strategy workshop
Logo and wordmark
Colour and type
Brand guidelines', 1, 1),
 ('Web design and development', 'Fast, accessible websites built to show your work at its best.', 'UX and UI design
Front-end build
Performance tuning
Launch support', 1, 2),
 ('Art direction', 'Concept and creative direction for campaigns, content and launches.', 'Campaign concepts
Shoot direction
Asset rollout', 1, 3),
 ('Packaging and print', 'Physical design from packaging to editorial and collateral.', 'Packaging
Editorial layout
Print production files', 1, 4);

UPDATE settings SET value = 'Placeholder biography. Angel will replace this text from the admin portal.' WHERE key = 'about';
UPDATE settings SET value = 'Based anywhere' WHERE key = 'location';

INSERT INTO messages (name, email, message, ip_hash, is_read) VALUES
 ('Sample Visitor', 'visitor@example.com', 'Hi Angel, we love your work and would like to talk about a brand refresh for our studio. Are you taking new projects this autumn?', 'sample', 0),
 ('Another Sample', 'hello@example.com', 'Quick question about your rates for a short animation.', 'sample', 1);

-- Ongoing client work (private: not published to the site)
INSERT INTO projects (id, slug, title, category, summary, client, status, progress, due_date, share_token, published, position) VALUES
 (7, 'harbor-cafe-rebrand', 'Harbor Cafe Rebrand', 'brand', 'Identity and menu system for a harbourfront cafe.', 'Harbor Cafe', 'ongoing', 0, date('now', '+24 days'), 'a1b2c3d4e5f60718293a4b5c6d7e8f90', 0, 7),
 (8, 'lumen-studio-site', 'Lumen Studio Website', 'development', 'Marketing site for a lighting design studio.', 'Lumen Studio', 'on_hold', 35, date('now', '+45 days'), NULL, 0, 8);

INSERT INTO milestones (project_id, title, due_date, done, client_visible, position) VALUES
 (7, 'Discovery workshop', date('now', '-12 days'), 1, 1, 0),
 (7, 'Logo concepts', date('now', '-2 days'), 1, 1, 1),
 (7, 'Concept revisions', date('now', '+3 days'), 0, 1, 2),
 (7, 'Menu and signage design', date('now', '+14 days'), 0, 1, 3),
 (7, 'Internal: invoice deposit', date('now', '+1 days'), 0, 0, 4);

INSERT INTO deliverables (project_id, title, description, url, status, client_visible, position) VALUES
 (7, 'Brand strategy one-pager', 'Positioning, audience and tone of voice.', 'https://example.com/strategy', 'approved', 1, 0),
 (7, 'Logo concepts (3 routes)', 'Three directions for review.', 'https://example.com/logos', 'delivered', 1, 1),
 (7, 'Final identity guidelines', 'Colour, type, logo usage.', '', 'pending', 1, 2);

INSERT INTO project_updates (project_id, body, client_visible, created_at) VALUES
 (7, 'Kick-off done. Moodboards approved by the team.', 1, datetime('now', '-12 days')),
 (7, 'Three logo routes delivered. Waiting on feedback by Friday.', 1, datetime('now', '-2 days')),
 (7, 'Client slow to reply; chase on Monday.', 0, datetime('now', '-1 days'));

-- Internal operations
INSERT INTO tasks (title, notes, priority, status, due_date, recurrence, project_id) VALUES
 ('Send invoice to Harbor Cafe', 'Deposit invoice, 50%.', 'urgent', 'todo', date('now', '-1 days'), 'none', 7),
 ('Chase Harbor Cafe for logo feedback', '', 'high', 'doing', date('now'), 'none', 7),
 ('Weekly backup of project files', 'Copy to the external drive.', 'normal', 'todo', date('now', '+2 days'), 'weekly', NULL),
 ('Monthly bookkeeping', 'Reconcile receipts.', 'high', 'todo', date('now', '+9 days'), 'monthly', NULL),
 ('Update portfolio with new case study', '', 'low', 'todo', '', 'none', NULL),
 ('Renew domain name', '', 'normal', 'done', date('now', '-20 days'), 'yearly', NULL);
