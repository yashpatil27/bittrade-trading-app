-- Cleanup script to remove cancelled DCA plans
-- This script safely removes cancelled DCA plans from the database

USE bittrade;

-- First, check if there are any operations referencing cancelled plans
-- This should show 0 records if it's safe to proceed
SELECT COUNT(*) as operations_referencing_cancelled_plans 
FROM operations o 
JOIN active_plans ap ON o.parent_id = ap.id 
WHERE ap.status = 'CANCELLED';

-- If the above query returns 0, it's safe to proceed with deletion
-- If it returns > 0, we need to handle those operations first

-- Show what we're about to delete (for verification)
SELECT id, user_id, plan_type, frequency, status, created_at, completed_at
FROM active_plans 
WHERE status = 'CANCELLED'
ORDER BY completed_at DESC;

-- Delete cancelled DCA plans
-- This will automatically set parent_id to NULL for any operations that reference these plans
-- (due to the ON DELETE SET NULL constraint)
DELETE FROM active_plans WHERE status = 'CANCELLED';

-- Verify deletion was successful
SELECT COUNT(*) as remaining_cancelled_plans FROM active_plans WHERE status = 'CANCELLED';

-- Show summary of remaining plans
SELECT status, COUNT(*) as count FROM active_plans GROUP BY status;
