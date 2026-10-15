-- REN-416: workspace access comes from organization_members only.
--
-- Before this migration a user could reach another workspace three ways:
--   1. caller_organization_ids() also trusted profiles.organization_id, and
--      profiles_self (FOR ALL) let users update it, or delete and re-insert
--      their profile with any organization_id.
--   2. members_insert_self let a user add themselves to any workspace, with
--      any role, including owner.
-- Every *_isolation policy calls caller_organization_ids(), so redefining it
-- fixes all 48 of them without touching the policies themselves.
--
-- Legitimate writers are unaffected: create_organization_with_owner() and the
-- handle_new_user() sign-up trigger are SECURITY DEFINER and run as the table
-- owner, so neither needs the client policies or grants removed here.

-- ============ SAFETY NET: PROFILE POINTERS ============
-- Point any profile whose workspace the user is not a member of at their
-- earliest membership, or NULL when they have none. Zero rows matched when
-- this was written; kept so the migration is safe wherever it is applied.
UPDATE profiles p
SET organization_id = (
  SELECT m.organization_id FROM organization_members m
  WHERE m.user_id = p.id
  ORDER BY m.created_at, m.organization_id
  LIMIT 1
)
WHERE p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.user_id = p.id AND m.organization_id = p.organization_id
  );

-- ============ ACCESS FROM MEMBERSHIP ONLY ============
-- profiles.organization_id stays as the user's current-workspace preference;
-- it no longer grants access to anything.
CREATE OR REPLACE FUNCTION caller_organization_ids() RETURNS SETOF uuid AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============ NO SELF-SERVICE MEMBERSHIP ============
-- Onboarding adds the owner through create_organization_with_owner(). There
-- is no invite flow; when one is built it needs its own SECURITY DEFINER
-- function that checks the inviter's role.
DROP POLICY IF EXISTS members_insert_self ON organization_members;

-- ============ PROFILES ARE READ-ONLY TO CLIENTS ============
-- Privileges, not a policy: RLS WITH CHECK cannot see the old value, and a
-- FOR ALL policy also allowed delete and re-insert. Nothing in the app writes
-- profiles from a client. To allow editing a field later, grant UPDATE on
-- that column only.
DROP POLICY IF EXISTS profiles_self ON profiles;
DROP POLICY IF EXISTS profiles_self_read ON profiles;
CREATE POLICY profiles_self_read ON profiles FOR SELECT
  USING (id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON profiles FROM anon, authenticated;
