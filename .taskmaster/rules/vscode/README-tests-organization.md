# Test Organization Rules

This rule set ensures all tests in the Jabbr Trading Bot Platform follow the
standardized organization structure that was established.

## Overview

The test organization rule enforces the following:

1. **Test File Location**: All test files must be located within the `/tests`
   directory
2. **Test Organization Structure**: Tests must follow the established structure
   (unit, integration, e2e)
3. **Package-specific Organization**: Unit and integration tests must be
   organized by package (backend, frontend, shared)
4. **Import Paths**: Test files should use proper relative paths to source files
5. **Filename Convention**: Test files should follow the naming convention:
   `component-name.test.ts` or `feature.spec.ts`
6. **Fixture Organization**: Test fixtures should be stored in the
   `/tests/fixtures` directory

## Directory Structure

```
/tests                      # Root test directory
├── unit/                   # Unit tests
│   ├── backend/            # Backend unit tests
│   ├── frontend/           # Frontend unit tests
│   └── shared/             # Shared package unit tests
├── integration/            # Integration tests
│   ├── backend/            # Backend integration tests
│   └── frontend/           # Frontend integration tests
├── e2e/                    # End-to-end tests
│   ├── trading/            # Trading system E2E tests
│   └── ui/                 # UI E2E tests
└── fixtures/               # Shared test fixtures/data
    ├── backend/            # Backend test fixtures
    └── frontend/           # Frontend test fixtures
```

## Examples

### Proper test file placement

✅ Good:

```
tests/unit/backend/services/bot.service.test.ts
tests/integration/backend/strategies/strategy-factory.test.ts
tests/e2e/trading/engine/standalone-engine.test.ts
```

❌ Bad:

```
packages/backend/tests/services/bot.service.test.ts
packages/backend/src/services/bot.service.test.ts
tests/bot.service.test.ts
```

### Proper import paths

✅ Good:

```typescript
import { BotService } from '../../../../packages/backend/src/services/bot.service';
```

❌ Bad:

```typescript
import { BotService } from '../../services/bot.service';
```

## How to Create New Tests

When creating new tests, make sure to:

1. Place the test file in the appropriate directory based on test type and
   package
2. Follow the naming convention: `component-name.test.ts`
3. Use proper relative paths for imports
4. Place shared test fixtures in the fixtures directory

For more details, refer to the
[Test Organization Guide](../../../tests/TEST_ORGANIZATION_GUIDE.md).
