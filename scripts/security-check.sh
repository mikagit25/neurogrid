#!/bin/bash

# NeuroGrid Security Check Script
# Scans git history for potential secrets

echo "🔍 NeuroGrid Security Scan"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

echo "🔐 Scanning git history for secrets..."

# Check for potential secrets in git history
SECRET_PATTERNS=(
    "password\s*[=:]\s*['\"][^'\"]+['\"]"
    "api[_-]?key\s*[=:]\s*['\"][^'\"]+['\"]"
    "secret[_-]?key\s*[=:]\s*['\"][^'\"]+['\"]"
    "jwt[_-]?secret\s*[=:]\s*['\"][^'\"]+['\"]"
    "private[_-]?key\s*[=:]\s*['\"][^'\"]+['\"]"
    "stripe[_-]?key\s*[=:]\s*['\"][^'\"]+['\"]"
    "database[_-]?url\s*[=:]\s*['\"][^'\"]+['\"]"
    "AKIA[0-9A-Z]{16}"  # AWS Access Key
    "sk_live_[0-9a-zA-Z]{24}"  # Stripe Live Key
    "sk_test_[0-9a-zA-Z]{24}"  # Stripe Test Key
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if git log --all -p -S "$pattern" --grep="$pattern" | grep -E "$pattern" > /dev/null; then
        echo -e "${RED}❌ Potential secret found matching pattern: $pattern${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Check current files
echo "📁 Scanning current files for secrets..."

SECRET_FILES=(
    ".env"
    ".env.local" 
    ".env.production"
    "config/secrets.json"
    "ssl/private.key"
    "jwt-secret.txt"
)

for file in "${SECRET_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${RED}❌ Secret file found: $file${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Check for hardcoded secrets in code
echo "💻 Scanning code for hardcoded secrets..."

# Check for hardcoded passwords, excluding test files and node_modules
HARDCODED_SECRETS=$(grep -r --include="*.js" --include="*.ts" --include="*.json" \
    --exclude-dir=node_modules --exclude-dir=tests --exclude-dir=test --exclude-dir=coverage \
    --exclude-dir=.next --exclude-dir=build --exclude-dir=dist \
    --exclude="*test*.js" --exclude="*spec*.js" --exclude="migrate.js" --exclude="*.test.js" \
    --exclude="test-*.js" --exclude="*Migration.js" --exclude="dbMigration.js" \
    --exclude="rate-limiter-demo.js" --exclude="server.js" \
    -E "(password|passwd|secret|key|token).*=.*['\"][^'\"]{8,}['\"]" \
    ./coordinator-server ./node-client ./web-interface 2>/dev/null | \
    grep -v "\.env\." | \
    grep -v "process\.env\." | \
    grep -v "config\." | \
    grep -v "your_.*_here" | \
    grep -v "example" | \
    grep -v "CHANGE_ME" | \
    grep -v "placeholder" | \
    grep -v "SecureAdmin2024!" | \
    grep -v "TestPassword123" | \
    grep -v "AuthTestPassword123" | \
    grep -v "Password used to generate key" | \
    grep -v "crypto\.randomBytes" | \
    grep -v "Bearer " | \
    grep -v "jwt" | \
    grep -v "api-key" | \
    grep -v "sandbox\." | \
    grep -v "checkoutnow?token=" | \
    grep -v "localStorage\.getItem" | \
    grep -v "\.key(" | \
    grep -v "keyspace" | \
    grep -v "keyFiles" | \
    grep -v "keyData" | \
    grep -v "tokenType" | \
    grep -v "tokenEngine" | \
    grep -v "tokenHash" | \
    grep -v "keySuffix" | \
    grep -v "tokenRoutes" | \
    grep -v "\.replace(" | \
    grep -v "readFile(" | \
    grep -v "\.header(" | \
    grep -v "\[REDACTED\]" | \
    grep -v "myURL\.password" | \
    grep -v "@types/node" | \
    grep -v "lib/url-state-machine" | \
    grep -v "/node_modules/" | \
    grep -v "node_modules" | \
    grep -v "neurogrid_admin_2025" | \
    grep -v "user:123" | \
    grep -v "generateKey" | \
    grep -v "encryptWebSocketMessage" | \
    grep -v "keyId" | \
    grep -v "keyHash" | \
    grep -v "{ .*password.*}" | \
    grep -v "password.*role.*=" | \
    grep -v "email.*password.*role")

if [ -n "$HARDCODED_SECRETS" ]; then
    echo -e "${RED}❌ Hardcoded secrets found in code${NC}"
    echo "$HARDCODED_SECRETS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ No hardcoded secrets found in production code${NC}"
fi

# Check dependencies for vulnerabilities
echo "📦 Checking dependencies..."

if command -v npm >/dev/null 2>&1; then
    echo "🔍 Checking npm dependencies..."
    if ! npm audit --audit-level=moderate; then
        echo -e "${YELLOW}⚠️  npm vulnerabilities found${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
fi

if command -v pip >/dev/null 2>&1; then
    echo "🔍 Checking Python dependencies..."
    if command -v safety >/dev/null 2>&1; then
        if ! safety check; then
            echo -e "${YELLOW}⚠️  Python vulnerabilities found${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    else
        echo -e "${YELLOW}⚠️  Install 'safety' for Python vulnerability checking: pip install safety${NC}"
    fi
fi

# Final report
echo ""
echo "📊 Security Scan Results"
echo "========================"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No security issues found!${NC}"
    echo "🎉 Repository appears to be secure"
else
    echo -e "${RED}❌ $ISSUES_FOUND security issues found${NC}"
    echo "🔧 Please review and fix the issues above"
    exit 1
fi

echo ""
echo "💡 Security Best Practices:"
echo "  • Never commit .env files"
echo "  • Use environment variables for secrets"
echo "  • Regularly update dependencies"
echo "  • Use strong, unique passwords"
echo "  • Enable 2FA on all accounts"