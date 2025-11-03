-- Migration: Add VK ID authentication support
-- Created: 2025-01-20
-- Description: Adds vk_user_id column to clients table and creates index

-- Add vk_user_id column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS vk_user_id bigint UNIQUE;

-- Create index for faster VK user lookups
CREATE INDEX IF NOT EXISTS idx_clients_vk_user_id
ON clients(vk_user_id)
WHERE vk_user_id IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN clients.vk_user_id IS 'VK user ID for VK ID authentication';

-- Update RLS policies to allow VK authentication
-- Allow users to read their own data (both Telegram and VK users)
CREATE POLICY IF NOT EXISTS "Users can read own data via VK"
ON clients FOR SELECT
USING (
    auth.uid() = id::text
    OR extra->>'telegram_user_id' = current_setting('request.jwt.claims', true)::json->>'sub'
    OR vk_user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
);

-- Add validation constraint
ALTER TABLE clients
ADD CONSTRAINT check_auth_provider
CHECK (
    telegram_user_id IS NOT NULL
    OR vk_user_id IS NOT NULL
);

COMMENT ON CONSTRAINT check_auth_provider ON clients IS
'Ensure at least one authentication provider (Telegram or VK) is set';
