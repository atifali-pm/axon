-- Create additional databases for n8n + langfuse.
-- These are created at first container boot, then extensions are enabled on the main DB.
CREATE DATABASE n8n;
CREATE DATABASE langfuse;

\c axon
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
