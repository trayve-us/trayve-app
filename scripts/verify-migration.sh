#!/bin/bash

# Verification script for migration to self-contained architecture
# This script checks that all external backend dependencies have been removed

echo "🔍 Verifying migration to self-contained architecture..."
echo ""

# Check for removed files
echo "1. Checking for legacy backend files..."
LEGACY_FILES=(
  "app/routes/api.backend-proxy.tsx"
  "app/routes/api.proxy.models.tsx"
  "app/lib/backend-api.ts"
  "app/lib/trayve-api.client.ts"
  "app/lib/trayve-api-client.ts"
  "app/lib/api-client.ts"
  "app/lib/storage.server.ts"
)

FOUND_LEGACY=0
for file in "${LEGACY_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ❌ Found legacy file: $file"
    FOUND_LEGACY=1
  fi
done

if [ $FOUND_LEGACY -eq 0 ]; then
  echo "   ✅ All legacy files removed"
fi
echo ""

# Check for service layer
echo "2. Checking service layer..."
REQUIRED_FILES=(
  "app/lib/services/index.ts"
  "app/lib/services/models.service.ts"
  "app/lib/services/storage.service.ts"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "   ❌ Missing required file: $file"
    MISSING_FILES=1
  fi
done

if [ $MISSING_FILES -eq 0 ]; then
  echo "   ✅ Service layer complete"
fi
echo ""

# Check for external API references
echo "3. Checking for external API references..."
EXTERNAL_REFS=$(grep -r "trayve\.app\|TRAYVE_BACKEND\|backend-proxy" app/ 2>/dev/null | grep -v "node_modules" | wc -l)
if [ "$EXTERNAL_REFS" -gt 0 ]; then
  echo "   ⚠️  Found $EXTERNAL_REFS references to external backend:"
  grep -r "trayve\.app\|TRAYVE_BACKEND\|backend-proxy" app/ 2>/dev/null | grep -v "node_modules"
else
  echo "   ✅ No external API references found"
fi
echo ""

# Check API routes
echo "4. Checking API routes..."
if [ -f "app/routes/api.models.tsx" ]; then
  echo "   ✅ API models route exists"
else
  echo "   ❌ Missing API models route"
fi
echo ""

# Check documentation
echo "5. Checking documentation..."
if [ -f "docs/API_ORGANIZATION.md" ]; then
  echo "   ✅ API organization docs exist"
else
  echo "   ❌ Missing API organization docs"
fi

if [ -f "docs/MIGRATION_SUMMARY.md" ]; then
  echo "   ✅ Migration summary docs exist"
else
  echo "   ❌ Missing migration summary docs"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FOUND_LEGACY -eq 0 ] && [ $MISSING_FILES -eq 0 ] && [ "$EXTERNAL_REFS" -eq 0 ]; then
  echo "✅ Migration verification PASSED"
  echo "   Your app is now fully self-contained!"
else
  echo "⚠️  Migration verification found issues"
  echo "   Please review the output above"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
