# Auth Flow Testing Summary

## Changes Made

### API (apps/api)

1. **Fixed cookie-parser middleware** - Added `cookie-parser` to parse cookies from requests
   - Added to `package.json` dependencies
   - Configured in `main.ts` and test setup

2. **Improved cookie settings** - Enhanced security and expiration
   - Added `secure` flag for production
   - Added `maxAge` for proper expiration (15min for access, 7 days for refresh)

3. **Fixed error handling** - Using proper NestJS exceptions
   - `UnauthorizedException` for invalid credentials
   - `ConflictException` for duplicate email registration

4. **Fixed logout endpoint** - Now returns proper response message

### Web (apps/web)

1. **Fixed API endpoint paths**
   - Fixed `authApi.me()` to use `/api/users/me` instead of `/auth/me`
   - Fixed `authApi.logout()` to use `/api/auth/logout` instead of `/auth/logout`

2. **Improved login/register pages**
   - Now use `authApi` instead of direct fetch calls
   - Added error handling and display
   - Removed unused `name` field from register form
   - Added form validation (required fields, email type, min password length)

3. **Updated types** - Removed `name` from `RegisterRequest` to match API

### Testing

1. **Created comprehensive e2e tests** (`test/auth.e2e-spec.ts`)
   - Register endpoint tests
   - Login endpoint tests
   - Get user data tests
   - Cookie verification tests
   - Error handling tests

2. **Created manual test script** (`test-auth.sh`)
   - Tests all auth endpoints
   - Verifies cookies are set correctly
   - Tests error cases

## Testing Instructions

### Prerequisites

1. Install dependencies:

   ```bash
   cd apps/api
   pnpm install  # This will install cookie-parser
   ```

2. Make sure your database is set up and migrations are run:

   ```bash
   cd apps/api
   pnpm prisma migrate dev
   ```

3. Set environment variables (if needed):
   ```bash
   # In apps/api/.env or your environment
   JWT_SECRET=your-secret-key-here
   CORS_ORIGIN=http://localhost:3000
   PORT=4000
   ```

### Running E2E Tests

```bash
cd apps/api
pnpm test:e2e
```

This will run all e2e tests including the new auth tests.

### Running Manual Test Script

1. Start the API server:

   ```bash
   cd apps/api
   pnpm dev
   ```

2. In another terminal, run the test script:
   ```bash
   cd apps/api
   ./test-auth.sh
   ```

### Testing in Browser

1. Start both servers:

   ```bash
   # Terminal 1 - API
   cd apps/api
   pnpm dev

   # Terminal 2 - Web
   cd apps/web
   pnpm dev
   ```

2. Open browser to `http://localhost:3000`

3. Test the flow:
   - Go to `/auth/register` and create an account
   - Check browser DevTools → Application → Cookies to verify cookies are set
   - Go to `/auth/login` and login with the same credentials
   - Verify cookies are set again
   - Navigate to `/dashboard` - should work if authenticated
   - Check `/dashboard/profile` to see user data

4. Verify cookies:
   - Open DevTools → Application → Cookies → `http://localhost:4000`
   - You should see:
     - `accessToken` (httpOnly, expires in 15 minutes)
     - `refreshToken` (httpOnly, expires in 7 days)

### Expected Cookie Behavior

- **Register/Login**: Sets both `accessToken` and `refreshToken` cookies
- **Get User Data**: Requires `accessToken` cookie to be present
- **Logout**: Clears both cookies
- **Cookies are httpOnly**: Cannot be accessed via JavaScript (security)
- **Cookies include credentials**: Sent automatically with requests when `credentials: 'include'` is set

## Key Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/users/me` - Get current user data (requires auth)

## Troubleshooting

### Cookies not being set

1. Check CORS configuration - make sure `credentials: true` is set
2. Check cookie-parser is installed and configured
3. Verify API and web are on correct ports (4000 and 3000)
4. Check browser console for CORS errors

### 401 Unauthorized errors

1. Verify JWT_SECRET is set in environment
2. Check that cookies are being sent (check Network tab in DevTools)
3. Verify cookie names match (`accessToken`)

### Tests failing

1. Make sure database is accessible
2. Check that test database is clean or tests clean up after themselves
3. Verify all dependencies are installed
