# Task Organization Rule

This rule ensures that task tracking and reporting follows consistent standards across the entire project.

## Purpose

As the project evolves, task tracking can become inconsistent with varying statuses, priorities, and reporting. This rule provides automated checks to maintain task organization standards and ensure accurate project status reporting.

## What This Rule Enforces

1. **Task Statistics Consistency**
   - Ensures all documents report consistent task statistics:
   - 37 total tasks
   - 20 completed tasks
   - 54% completion rate

2. **Task Priority Alignment**
   - Validates that task priorities in code match documentation
   - Standardizes priority values to high, medium, and low

3. **Task Status Validation**
   - Ensures task status uses standardized values:
   - done
   - in-progress
   - pending
   - deferred
   - cancelled

4. **Task Documentation Alignment**
   - Verifies that tasks mentioned in code are properly documented
   - Checks for missing task references

5. **Task Report Freshness**
   - Ensures the TASK_STATUS_REPORT.md is kept up to date
   - Validates that report dates are current

## How to Use

Run the task organization check with:

```bash
npx taskmaster lint
```

## How to Fix Issues

When inconsistencies are found:

1. Update the TASK_STATUS_REPORT.md with current task information
2. Ensure all documents reference consistent task statistics
3. Standardize task status values in code and documentation
4. Verify priority assignments match project needs
5. Re-run the check to verify fixes

## Benefits

- Maintains consistent project status reporting
- Ensures accurate task tracking
- Improves project management
- Helps team members understand current priorities
- Facilitates sprint planning and resource allocation

## Related Resources

- `docs/TASK_STATUS_REPORT.md`: Comprehensive task tracking and status
- `docs/DOCUMENTATION_MAINTENANCE.md`: Guide for maintaining documentation consistency
- `.taskmaster/tasks/tasks.json`: Master task data
