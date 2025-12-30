#!/bin/bash

# Test script for auth endpoints
# Make sure the API server is running on http://localhost:4000

API_URL="http://localhost:4000/api"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="testpassword123"

echo "🧪 Testing Auth Flow"
echo "==================="
echo ""

# Test 1: Register
echo "1️⃣ Testing Register..."
REGISTER_RESPONSE=$(curl -s -i -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | head -n 1 | cut -d' ' -f2)
COOKIES=$(echo "$REGISTER_RESPONSE" | grep -i "set-cookie")

if [ "$REGISTER_STATUS" = "201" ]; then
  echo "✅ Register successful (Status: $REGISTER_STATUS)"
  if echo "$COOKIES" | grep -q "accessToken"; then
    echo "✅ accessToken cookie set"
  else
    echo "❌ accessToken cookie NOT set"
  fi
  if echo "$COOKIES" | grep -q "refreshToken"; then
    echo "✅ refreshToken cookie set"
  else
    echo "❌ refreshToken cookie NOT set"
  fi
else
  echo "❌ Register failed (Status: $REGISTER_STATUS)"
  echo "$REGISTER_RESPONSE"
  exit 1
fi

echo ""

# Extract cookies for next requests
ACCESS_TOKEN_COOKIE=$(echo "$COOKIES" | grep "accessToken" | sed 's/.*accessToken=\([^;]*\).*/\1/')
REFRESH_TOKEN_COOKIE=$(echo "$COOKIES" | grep "refreshToken" | sed 's/.*refreshToken=\([^;]*\).*/\1/')

# Test 2: Get User Data (using cookies from register)
echo "2️⃣ Testing Get User Data (with cookies)..."
ME_RESPONSE=$(curl -s -i -X GET "$API_URL/users/me" \
  -H "Cookie: accessToken=$ACCESS_TOKEN_COOKIE; refreshToken=$REFRESH_TOKEN_COOKIE")

ME_STATUS=$(echo "$ME_RESPONSE" | head -n 1 | cut -d' ' -f2)
ME_BODY=$(echo "$ME_RESPONSE" | sed -n '/^$/,$p' | tail -n +2)

if [ "$ME_STATUS" = "200" ]; then
  echo "✅ Get user data successful (Status: $ME_STATUS)"
  if echo "$ME_BODY" | grep -q "$TEST_EMAIL"; then
    echo "✅ User email matches: $TEST_EMAIL"
  else
    echo "❌ User email mismatch"
  fi
else
  echo "❌ Get user data failed (Status: $ME_STATUS)"
  echo "$ME_RESPONSE"
  exit 1
fi

echo ""

# Test 3: Login
echo "3️⃣ Testing Login..."
LOGIN_RESPONSE=$(curl -s -i -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | head -n 1 | cut -d' ' -f2)
LOGIN_COOKIES=$(echo "$LOGIN_RESPONSE" | grep -i "set-cookie")

if [ "$LOGIN_STATUS" = "201" ]; then
  echo "✅ Login successful (Status: $LOGIN_STATUS)"
  if echo "$LOGIN_COOKIES" | grep -q "accessToken"; then
    echo "✅ accessToken cookie set"
  else
    echo "❌ accessToken cookie NOT set"
  fi
  if echo "$LOGIN_COOKIES" | grep -q "refreshToken"; then
    echo "✅ refreshToken cookie set"
  else
    echo "❌ refreshToken cookie NOT set"
  fi
else
  echo "❌ Login failed (Status: $LOGIN_STATUS)"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo ""

# Test 4: Invalid Login
echo "4️⃣ Testing Invalid Login..."
INVALID_LOGIN_RESPONSE=$(curl -s -i -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpassword\"}")

INVALID_LOGIN_STATUS=$(echo "$INVALID_LOGIN_RESPONSE" | head -n 1 | cut -d' ' -f2)

if [ "$INVALID_LOGIN_STATUS" = "401" ]; then
  echo "✅ Invalid login correctly rejected (Status: $INVALID_LOGIN_STATUS)"
else
  echo "❌ Invalid login should return 401, got: $INVALID_LOGIN_STATUS"
fi

echo ""

# Test 5: Get User Data without cookies
echo "5️⃣ Testing Get User Data (without cookies)..."
NO_COOKIE_RESPONSE=$(curl -s -i -X GET "$API_URL/users/me")
NO_COOKIE_STATUS=$(echo "$NO_COOKIE_RESPONSE" | head -n 1 | cut -d' ' -f2)

if [ "$NO_COOKIE_STATUS" = "401" ]; then
  echo "✅ Request without cookies correctly rejected (Status: $NO_COOKIE_STATUS)"
else
  echo "❌ Request without cookies should return 401, got: $NO_COOKIE_STATUS"
fi

echo ""
echo "==================="
echo "✅ All tests completed!"
echo ""
echo "Note: Test user created: $TEST_EMAIL"
echo "You may want to clean up this user from the database."

