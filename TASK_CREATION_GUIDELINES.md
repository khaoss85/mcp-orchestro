# Task Creation Guidelines

## Overview
This document provides guidelines for creating tasks in Orchestro, ensuring consistency across languages and proper tagging.

## Test Task Tagging

### Rule: Always Add "test" Tag for Test-Related Tasks

When creating tasks related to testing (unit tests, integration tests, E2E tests, test fixtures, test data, etc.), **ALWAYS** include `"test"` in the `tags` array, regardless of the language used in the title or description.

### Examples

✅ **Correct:**
```typescript
{
  title: "Write unit tests for payment API",
  tags: ["test", "unit-test", "api"]
}
```

```typescript
{
  title: "Scrivi test per il sistema di pagamento", // Italian
  tags: ["test", "integration-test"]
}
```

```typescript
{
  title: "Écrire des tests pour l'authentification", // French
  tags: ["test", "auth"]
}
```

❌ **Incorrect:**
```typescript
{
  title: "Write tests for user service",
  tags: ["unit-test", "user"] // Missing "test" tag!
}
```

```typescript
{
  title: "Test User Story - Payment System",
  tags: [] // No tags at all!
}
```

### Detection Mechanism

The UI automatically detects test tasks using **two methods**:

1. **Tag-based detection**: Checks if `"test"` exists in the `tags` array (case-insensitive)
2. **Title-based detection**: Checks if the word "test" appears in the title (case-insensitive, fallback)

While title-based detection works as a fallback, it's **language-specific** and may not work for non-English titles. Therefore, always use the `"test"` tag for reliable detection.

## Visual Indicators

Test tasks are visually distinguished in the Kanban board:

- **Purple ring border** around the card
- **Purple "TEST" badge** next to the title
- Can be **filtered out** using the "Hide Tests" button

## Multi-Language Support

### Why Tags Matter

Tags provide language-independent classification:

- ✅ `tags: ["test"]` works in **all languages**
- ❌ Title "test" only works in **English**
- ❌ Title "prueba" (Spanish) would not be detected
- ❌ Title "テスト" (Japanese) would not be detected

### Recommended Practice

Always include the English `"test"` tag, even if the title/description uses another language:

```typescript
{
  title: "Pruebas de integración para el módulo de pagos", // Spanish
  description: "Crear pruebas de integración completas",
  tags: ["test", "integration-test", "payments"] // English tag
}
```

## Tag Conventions

Use these standard tags for consistency:

### Test-Related Tags
- `test` - **Required** for all test tasks
- `unit-test` - Unit testing
- `integration-test` - Integration testing
- `e2e-test` - End-to-end testing
- `performance-test` - Performance/load testing
- `test-data` - Test data generation/fixtures
- `test-setup` - Test environment setup

### Other Common Tags
- `bug` - Bug fixes
- `feature` - New features
- `refactor` - Code refactoring
- `docs` - Documentation
- `ci-cd` - CI/CD related
- `security` - Security-related
- `performance` - Performance optimization

## MCP Tool Usage

When using `orchestro - create_task`, always include the `tags` parameter:

```typescript
{
  title: "Write API tests",
  description: "Create comprehensive test suite for REST API endpoints",
  status: "todo",
  tags: ["test", "api", "unit-test"],
  priority: "high"
}
```

## Summary

**Key Takeaway:** When creating test-related tasks, always add `"test"` to the `tags` array for reliable, language-independent detection and filtering.
