# Auth Test Fixes

## Issues Fixed

### 1. E2E Test Failures

**Problem**: Tests were failing due to:

- Missing Jest dependencies (workspace issue)
- Cookie extraction not working correctly in tests
- Cookies not being sent properly in subsequent requests

**Solution**:

- Updated test to use `request.agent()` from supertest, which automatically maintains cookies across requests
- Improved cookie extraction and validation in tests
- Added better error handling and assertions

### 2. GET /api/users/me Returning 401

**Problem**: Even with access and refresh tokens in cookies, the endpoint was returning 401.

**Root Causes**:

1. JWT strategy cookie extraction needed better type safety
2. Test cookies weren't being properly maintained across requests
3. Cookie format in tests needed to match what the server expects

**Solutions**:

1. **Improved JWT Strategy** (`apps/api/src/auth/jwt.strategy.ts`):
   - Added proper TypeScript types for Request
   - Improved cookie extraction logic with explicit null handling
   - Better error handling

2. **Fixed Test Cookie Handling** (`apps/api/test/auth.e2e-spec.ts`):
   - Switched to using `request.agent()` which maintains cookies automatically
   - This ensures cookies from register/login are automatically sent in subsequent requests
   - Removed manual cookie extraction and header setting

3. **Updated Test Configuration** (`apps/api/test/jest-e2e.json`):
   - Added module name mapper for better path resolution

## Key Changes

### JWT Strategy

```typescript
// Before: Simple extraction
jwtFromRequest: ExtractJwt.fromExtractors([req => req?.cookies?.accessToken]);

// After: Explicit handling with types
jwtFromRequest: ExtractJwt.fromExtractors([
  (req: Request) => {
    if (req?.cookies?.accessToken) {
      return req.cookies.accessToken;
    }
    return null;
  },
]);
```

### Test Approach

```typescript
// Before: Manual cookie extraction and header setting
const cookies = extractCookies(response);
.set('Cookie', cookies)

// After: Use agent to maintain cookies automatically
const agent = request.agent(app.getHttpServer());
await agent.post('/api/auth/register')...
await agent.get('/api/users/me')... // Cookies automatically included
```

## Testing

To run the tests:

```bash
cd apps/api
pnpm run test:e2e
```

The tests should now:

- ✅ Register users and verify cookies are set
- ✅ Login users and verify cookies are set
- ✅ Get user data using cookies from previous requests
- ✅ Reject requests without cookies
- ✅ Reject requests with invalid tokens

## Manual Testing

To test the actual API:

1. Start the API server:

   ```bash
   cd apps/api
   pnpm dev
   ```

2. Test with curl:

   ```bash
   # Register
   curl -i -X POST http://localhost:4000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}' \
     -c cookies.txt

   # Get user data (cookies from cookies.txt)
   curl -i -X GET http://localhost:4000/api/users/me \
     -b cookies.txt
   ```

3. Or use the test script:
   ```bash
   cd apps/api
   ./test-auth.sh
   ```

## Notes

- The `request.agent()` approach is the recommended way to test cookie-based authentication with supertest
- Cookie-parser middleware must be configured in both the main app and test setup
- JWT_SECRET should be set in environment or will default to 'dev-secret'
