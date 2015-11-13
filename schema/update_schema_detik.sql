-- Create Trigger Function to update all_reports table
CREATE OR REPLACE FUNCTION public.update_all_reports_from_detik()
  RETURNS trigger AS
$BODY$
	BEGIN
		IF (TG_OP = 'UPDATE') THEN
			INSERT INTO all_reports (fkey, created_at, text, source, lang, url, image_url, title, the_geom) SELECT NEW.pkey, NEW.created_at, NEW.text, 'detik', NEW.url, NEW.image_url, NEW.title, NEW.the_geom;
			RETURN NEW;
		ELSIF (TG_OP = 'INSERT') THEN
			INSERT INTO all_reports (fkey, created_at, text, source, lang, url, image_url, title, the_geom) SELECT NEW.pkey, NEW.created_at, NEW.text, 'detik', NEW.lang, NEW.url, NEW.image_url, NEW.title, NEW.the_geom;
			RETURN NEW;
		END IF;
	END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION public.update_all_reports_from_detik()
  OWNER TO postgres;


-- Create table for Detik reports
CREATE TABLE detik_reports
(
  pkey bigserial NOT NULL,
  contribution_id bigint NOT NULL,
  database_time timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone,
  text character varying,
  lang character varying,
  url character varying,
  image_url character varying,
  title character varying,
  CONSTRAINT pkey_detik PRIMARY KEY (pkey)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE detik_reports
  OWNER TO postgres;

-- Add Geometry column to tweet_reports
SELECT AddGeometryColumn ('public','detik_reports','the_geom',4326,'POINT',2);

-- Add GIST spatial index
CREATE INDEX gix_detik_reports ON detik_reports USING gist (the_geom);

CREATE TRIGGER trigger_update_all_reports_from_detik
  BEFORE INSERT OR UPDATE
  ON public.detik_reports
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_all_reports_from_detik();

-- Create table for Detik report users
CREATE TABLE detik_users
(
  pkey bigserial,
  user_hash character varying UNIQUE,
  reports_count integer	,
  CONSTRAINT pkey_detik_users PRIMARY KEY (pkey)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE detik_users
  OWNER TO postgres;

  --Function to update or insert tweet users
  CREATE FUNCTION upsert_detik_users(hash varchar) RETURNS VOID AS
  $$
  BEGIN
      LOOP
          -- first try to update the key
          UPDATE detik_users SET reports_count = reports_count + 1 WHERE user_hash = hash;
          IF found THEN
              RETURN;
          END IF;
          -- not there, so try to insert the key
          -- if someone else inserts the same key concurrently,
          -- we could get a unique-key failure
          BEGIN
              INSERT INTO detik_users(user_hash,reports_count) VALUES (hash, 1);
              RETURN;
          EXCEPTION WHEN unique_violation THEN
              -- Do nothing, and loop to try the UPDATE again.
          END;
      END LOOP;
  END;
  $$
  LANGUAGE plpgsql;
