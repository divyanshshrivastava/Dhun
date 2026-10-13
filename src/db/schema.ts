import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  smallint,
  integer,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Musical Works (Canonical compositions to group remakes, covers & reprises)
export const musicalWorks = pgTable(
  'musical_works',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    canonical_title: varchar('canonical_title', { length: 255 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_works_title').on(table.canonical_title),
  ]
);

// 2. Songs Catalog (Specific recordings/releases of musical works)
export const songs = pgTable(
  'songs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    work_id: uuid('work_id')
      .notNull()
      .references(() => musicalWorks.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    normalized_title: varchar('normalized_title', { length: 255 }).notNull(),
    aliases: text('aliases').array().notNull().default([]),
    artists: text('artists').array().notNull().default([]),
    movie_or_album: varchar('movie_or_album', { length: 255 }),
    language: varchar('language', { length: 50 }).notNull(),
    era: varchar('era', { length: 20 }).notNull(),
    genres: text('genres').array().notNull().default([]),
    difficulty: varchar('difficulty', { length: 20 }).default('medium').notNull(),
    audio_source_type: varchar('audio_source_type', { length: 50 }).default('local_upload').notNull(),
    external_source_id: varchar('external_source_id', { length: 255 }),
    spotify_url: varchar('spotify_url', { length: 500 }),
    youtube_url: varchar('youtube_url', { length: 500 }),
    active: boolean('active').default(true).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_songs_work_id').on(table.work_id),
    index('idx_songs_title').on(table.title),
    index('idx_songs_normalized').on(table.normalized_title),
    index('idx_songs_lang_era').on(table.language, table.era),
    index('idx_songs_active').on(table.active),
  ]
);

// 3. Song Clips (Pre-sliced cumulative audio tracks)
// Attempt indices 0, 1, 2 (0.1s, 0.5s, 1.5s) are lossless WAV.
// Attempt indices 3, 4, 5 (4s, 8s, 15s) are AAC/m4a.
export const songClips = pgTable(
  'song_clips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    song_id: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
    attempt_index: smallint('attempt_index').notNull(),
    duration_ms: integer('duration_ms').notNull(),
    storage_key: varchar('storage_key', { length: 500 }).notNull(),
    audio_format: varchar('audio_format', { length: 10 }).notNull(),
    file_size_bytes: integer('file_size_bytes').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('unq_song_attempt_format').on(
      table.song_id,
      table.attempt_index,
      table.audio_format
    ),
    index('idx_clips_song_attempt').on(table.song_id, table.attempt_index),
  ]
);

// 4. Daily Challenges (One curated song per calendar day in IST)
export const dailyChallenges = pgTable(
  'daily_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    challenge_date: date('challenge_date').notNull().unique(),
    song_id: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'restrict' }),
    published: boolean('published').default(true).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_daily_date').on(table.challenge_date),
  ]
);

// 5. Game Sessions (Server state for both daily and practice playthroughs)
export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guest_id: uuid('guest_id').notNull(),
    session_token_hash: varchar('session_token_hash', { length: 64 }).notNull(),
    mode: varchar('mode', { length: 20 }).notNull(), // 'DAILY' or 'PRACTICE'
    daily_challenge_id: uuid('daily_challenge_id').references(() => dailyChallenges.id),
    song_id: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'restrict' }),
    attempts_used: smallint('attempts_used').default(0).notNull(),
    max_attempts: smallint('max_attempts').default(6).notNull(),
    status: varchar('status', { length: 20 }).default('IN_PROGRESS').notNull(), // 'IN_PROGRESS', 'WON', 'LOST'
    filter_language: varchar('filter_language', { length: 50 }),
    filter_era: varchar('filter_era', { length: 20 }),
    filter_genre: varchar('filter_genre', { length: 50 }),
    started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completed_at: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_sessions_guest').on(table.guest_id),
    index('idx_sessions_mode_date').on(table.mode, table.daily_challenge_id),
    // Ensures a guest can only start one daily game per challenge date
    unique('unq_guest_daily').on(table.guest_id, table.daily_challenge_id),
  ]
);

// 6. Player Guesses (Attempt audit log)
export const guesses = pgTable(
  'guesses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    attempt_index: smallint('attempt_index').notNull(),
    guess_type: varchar('guess_type', { length: 20 }).notNull(), // 'SONG_GUESS' or 'SKIPPED'
    guessed_song_id: uuid('guessed_song_id').references(() => songs.id),
    raw_guess_text: varchar('raw_guess_text', { length: 255 }),
    is_correct: boolean('is_correct').default(false).notNull(),
    submitted_at: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_guesses_session').on(table.session_id),
  ]
);

// 7. Player Stats (Aggregated guest performance)
export const playerStats = pgTable(
  'player_stats',
  {
    guest_id: uuid('guest_id').primaryKey(),
    games_played: integer('games_played').default(0).notNull(),
    games_won: integer('games_won').default(0).notNull(),
    current_streak: integer('current_streak').default(0).notNull(),
    max_streak: integer('max_streak').default(0).notNull(),
    guess_distribution: jsonb('guess_distribution')
      .$type<Record<string, number>>()
      .default({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 })
      .notNull(),
    last_played_date: date('last_played_date'),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  }
);

// Relations
export const musicalWorksRelations = relations(musicalWorks, ({ many }) => ({
  recordings: many(songs),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  work: one(musicalWorks, {
    fields: [songs.work_id],
    references: [musicalWorks.id],
  }),
  clips: many(songClips),
  dailyChallenges: many(dailyChallenges),
  sessions: many(gameSessions),
}));

export const songClipsRelations = relations(songClips, ({ one }) => ({
  song: one(songs, {
    fields: [songClips.song_id],
    references: [songs.id],
  }),
}));

export const dailyChallengesRelations = relations(dailyChallenges, ({ one, many }) => ({
  song: one(songs, {
    fields: [dailyChallenges.song_id],
    references: [songs.id],
  }),
  sessions: many(gameSessions),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  song: one(songs, {
    fields: [gameSessions.song_id],
    references: [songs.id],
  }),
  dailyChallenge: one(dailyChallenges, {
    fields: [gameSessions.daily_challenge_id],
    references: [dailyChallenges.id],
  }),
  guesses: many(guesses),
}));

export const guessesRelations = relations(guesses, ({ one }) => ({
  session: one(gameSessions, {
    fields: [guesses.session_id],
    references: [gameSessions.id],
  }),
  guessedSong: one(songs, {
    fields: [guesses.guessed_song_id],
    references: [songs.id],
  }),
}));
