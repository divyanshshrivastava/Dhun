CREATE TABLE "daily_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_date" date NOT NULL,
	"song_id" uuid NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_challenges_challenge_date_unique" UNIQUE("challenge_date")
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"daily_challenge_id" uuid,
	"song_id" uuid NOT NULL,
	"attempts_used" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 6 NOT NULL,
	"status" varchar(20) DEFAULT 'IN_PROGRESS' NOT NULL,
	"filter_language" varchar(50),
	"filter_era" varchar(20),
	"filter_genre" varchar(50),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "unq_guest_daily" UNIQUE("guest_id","daily_challenge_id")
);
--> statement-breakpoint
CREATE TABLE "guesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"attempt_index" smallint NOT NULL,
	"guess_type" varchar(20) NOT NULL,
	"guessed_song_id" uuid,
	"raw_guess_text" varchar(255),
	"is_correct" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musical_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_title" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"guest_id" uuid PRIMARY KEY NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"guess_distribution" jsonb DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0}'::jsonb NOT NULL,
	"last_played_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"attempt_index" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"audio_format" varchar(10) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"normalized_title" varchar(255) NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"artists" text[] DEFAULT '{}' NOT NULL,
	"movie_or_album" varchar(255),
	"language" varchar(50) NOT NULL,
	"era" varchar(20) NOT NULL,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"difficulty" varchar(20) DEFAULT 'medium' NOT NULL,
	"audio_source_type" varchar(50) DEFAULT 'local_upload' NOT NULL,
	"external_source_id" varchar(255),
	"spotify_url" varchar(500),
	"youtube_url" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"clip_start_seconds" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_daily_challenge_id_daily_challenges_id_fk" FOREIGN KEY ("daily_challenge_id") REFERENCES "public"."daily_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_guessed_song_id_songs_id_fk" FOREIGN KEY ("guessed_song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_clips" ADD CONSTRAINT "song_clips_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_work_id_musical_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."musical_works"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_date" ON "daily_challenges" USING btree ("challenge_date");--> statement-breakpoint
CREATE INDEX "idx_sessions_guest" ON "game_sessions" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_mode_date" ON "game_sessions" USING btree ("mode","daily_challenge_id");--> statement-breakpoint
CREATE INDEX "idx_guesses_session" ON "guesses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_works_title" ON "musical_works" USING btree ("canonical_title");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_song_attempt_format" ON "song_clips" USING btree ("song_id","attempt_index","audio_format");--> statement-breakpoint
CREATE INDEX "idx_clips_song_attempt" ON "song_clips" USING btree ("song_id","attempt_index");--> statement-breakpoint
CREATE INDEX "idx_songs_work_id" ON "songs" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "idx_songs_title" ON "songs" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_songs_normalized" ON "songs" USING btree ("normalized_title");--> statement-breakpoint
CREATE INDEX "idx_songs_lang_era" ON "songs" USING btree ("language","era");--> statement-breakpoint
CREATE INDEX "idx_songs_active" ON "songs" USING btree ("active");