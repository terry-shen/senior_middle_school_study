-- Math Learning System Database Initialization Script
-- This script is executed when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE math_learning TO postgres;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Math Learning System database initialized successfully';
END
$$;