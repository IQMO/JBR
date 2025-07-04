# Documentation Consistency Rule

This rule ensures that all project documentation remains consistent and
up-to-date across the entire codebase.

## Purpose

As the project evolves, documentation can become inconsistent with varying
statistics, outdated references, and mismatched information. This rule provides
automated checks to identify inconsistencies and ensure documentation accuracy.

## What This Rule Enforces

1. **Project Statistics Consistency**
   - Ensures all documents report the same project statistics:
   - 37 total tasks
   - 20 completed tasks
   - 54% completion rate

2. **Documentation Date Consistency**
   - Verifies "Last Updated" dates are current
   - Flags outdated timestamps

3. **Test Command References**
   - Ensures test command references match package.json scripts
   - Prevents outdated command examples

4. **Documentation Cross-References**
   - Validates that cross-references point to existing files
   - Prevents broken documentation links

5. **Test Organization Documentation**
   - Ensures test files comply with TEST_ORGANIZATION_GUIDE.md standards
   - Maintains consistent test structure

## How to Use

Run the documentation consistency check with:

```bash
npx taskmaster lint
```

## How to Fix Issues

When inconsistencies are found:

1. Refer to `docs/DOCUMENTATION_MAINTENANCE.md` for a comprehensive list of all
   documentation files
2. Update the flagged documents to match current project statistics and
   standards
3. Always update the "Last Updated" date when making changes
4. Re-run the check to verify fixes

## Automatic Fixes

Some issues can be fixed automatically:

```bash
npx taskmaster lint --fix
```

## Benefits

- Maintains consistent project status reporting
- Ensures accurate technical documentation
- Reduces confusion from conflicting information
- Improves developer experience with reliable docs
- Facilitates proper project management with accurate metrics

## Related Resources

- `docs/DOCUMENTATION_MAINTENANCE.md`: Master reference for documentation
  standards
- `docs/TEST_ORGANIZATION_GUIDE.md`: Standards for test organization
