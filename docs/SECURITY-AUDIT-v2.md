# Security Audit & Remediations: skatehive-api v2

**Date**: 2026-03-15
**Status**: Completed / Pending Team Review
**Scope**: `skatehive-api/src/app/api/v2`

## Executive Summary
A comprehensive audit of the v2 API endpoints was conducted to identify security vulnerabilities, functional bugs, and architectural inconsistencies. All high-severity issues, including SQL injection and broken route parameters, have been resolved in this branch.

---

## 🚨 High Severity Issues Found & Fixed

### 1. SQL Injection Prevention
- **Issue**: Multiple routes were directly interpolating user strings into SQL queries, exposing the database to arbitrary command execution.
- **Fix**: All v2 routes and utilities (`fetchCommunityPosts`, `fetchCommunitySnaps`, etc.) have been migrated to **parameterized queries** using the `@parameter` syntax supported by the `HAFSQL_Database` wrapper.
- **Affected Routes**: `balance`, `rewards`, `followers`, `following`, `skatesnaps`, `profile`, and `feed`.

### 2. Dynamic Route Parameter Correction
- **Issue**: Endpoints in `[username]` directories were incorrectly relying on URL query strings (`?username=...`) instead of the path parameters provided by Next.js.
- **Fix**: Logic updated to correctly destructure parameters from the `params` argument: `const { username } = await params`.
- **Resolved Routes**: All routes within `[username]` dynamic segments.

---

## 🟠 Medium Severity Issues Found & Fixed

### 3. Accurate Pagination
- **Issue**: Pagination metadata was calculating `totalPages` based on the limited result set rather than the total capacity of the database for that query.
- **Fix**: Implemented a separate `COUNT(*)` query for each feed route to return the true total count, enabling correct pagination for clients.

### 4. Authentication Standardization
- **Issue**: The `createpost` route lacked the API key validation and rate limiting present in other v2 POST routes.
- **Fix**: Integrated `validateApiKey` and `checkRateLimit` (10 requests/min) into the `createpost` logic.

### 5. Build Integrity
- **Issue**: The `ipfs/upload` route had an outdated import from a legacy authentication utility, causing build failures.
- **Fix**: Normalized imports to use the centralized `apiAuth.ts` utility.

---

## 🟡 Low Severity / Refactoring
- Updated the root `/api/v2` welcome message to correctly state "v2" instead of "v1".
- Removed redundant constant definitions and unused `HAFSQL_Database` instantiations in route files.

---

## Technical Debt / Future Recommendations
- **Authentication**: Moving from raw Hive Posting Keys in headers to a more standard OAuth2 flow or signed requests is recommended for high-security production environments.
- **Rate Limiting**: Current in-memory rate limiting should be migrated to Redis if scaling to multiple instances.

---

## Verification Summary

| Improvement | Previous State | New State |
| :--- | :--- | :--- |
| **SQL Security** | Vulnerable (String concatenation) | Secured (Named Parameters) |
| **Route Params** | Broken (SearchParam fallback) | Fixed (Path Parameters) |
| **Pagination** | Inaccurate (Result count) | Accurate (Total count) |
| **Auth Consistency** | Inconsistent (POST routes) | Unified (API Key Required) |
| **Build Status** | Failing (Outdated imports) | **Compiled Successfully** |
