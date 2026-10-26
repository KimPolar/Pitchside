CREATE TABLE leagues (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL, gender TEXT NOT NULL,
 age TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL
);
CREATE TABLE competitions (
 id TEXT PRIMARY KEY, league_id TEXT NOT NULL REFERENCES leagues(id), name TEXT NOT NULL,
 season INTEGER NOT NULL, region TEXT NOT NULL DEFAULT '', format TEXT NOT NULL DEFAULT 'league',
 availability TEXT NOT NULL DEFAULT 'not_collected', source TEXT NOT NULL, source_url TEXT NOT NULL,
 updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE teams (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, league_id TEXT NOT NULL REFERENCES leagues(id), emblem TEXT,
 source TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE aliases (
 id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL, alias TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0,
 UNIQUE(source, source_id, entity_type)
);
CREATE TABLE players (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, team_id TEXT REFERENCES teams(id), photo TEXT,
 source TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE matches (
 id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES competitions(id),
 home_id TEXT NOT NULL REFERENCES teams(id), away_id TEXT NOT NULL REFERENCES teams(id),
 kickoff TEXT, date TEXT NOT NULL, round TEXT NOT NULL DEFAULT '', stage TEXT NOT NULL DEFAULT '',
 venue TEXT NOT NULL DEFAULT '', home_score INTEGER, away_score INTEGER,
 status TEXT NOT NULL DEFAULT 'scheduled', detail_status TEXT NOT NULL DEFAULT 'not_collected',
 detail_message TEXT NOT NULL DEFAULT '', lineups_json TEXT NOT NULL DEFAULT '[]', events_json TEXT NOT NULL DEFAULT '[]',
 source TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE standings (
 id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES competitions(id), team_id TEXT NOT NULL REFERENCES teams(id),
 position INTEGER NOT NULL, played INTEGER, wins INTEGER, draws INTEGER, losses INTEGER,
 goals_for INTEGER, goals_against INTEGER, goal_difference INTEGER, points INTEGER,
 source TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE player_stats (
 id TEXT PRIMARY KEY, competition_id TEXT NOT NULL REFERENCES competitions(id), player_id TEXT NOT NULL REFERENCES players(id),
 team_id TEXT NOT NULL REFERENCES teams(id), position TEXT NOT NULL DEFAULT '', played INTEGER, minutes INTEGER,
 goals INTEGER, assists INTEGER, shots INTEGER, yellow_cards INTEGER, red_cards INTEGER,
 source TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE videos (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, channel TEXT NOT NULL, channel_id TEXT NOT NULL DEFAULT '',
 thumbnail TEXT NOT NULL, published_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'other',
 league_id TEXT REFERENCES leagues(id), match_id TEXT REFERENCES matches(id), team_names TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '', availability TEXT NOT NULL DEFAULT 'available',
 source TEXT NOT NULL, source_url TEXT NOT NULL, updated_at TEXT NOT NULL, manual_locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE source_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, status TEXT NOT NULL,
 started_at TEXT NOT NULL, finished_at TEXT, count INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT ''
);
CREATE TABLE source_metadata (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX match_date_idx ON matches(date);
CREATE INDEX competition_league_idx ON competitions(league_id, season);
CREATE INDEX video_published_idx ON videos(published_at);
CREATE INDEX video_match_idx ON videos(match_id);
