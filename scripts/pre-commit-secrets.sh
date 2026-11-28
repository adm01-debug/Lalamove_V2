#!/bin/bash
# =============================================================================
# PRE-COMMIT HOOK: Secret Detection
# Lalamove Guardian - Security Layer
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Scanning for secrets in staged files...${NC}"

# Patterns to detect
PATTERNS=(
    # API Keys
    'pk_prod_[A-Za-z0-9]{16,}'               # Lalamove API key de producao
    'sk_prod_[A-Za-z0-9]{16,}'               # Lalamove HMAC secret de producao
    'sb_publishable_[A-Za-z0-9_-]{20,}'      # Supabase chave publicavel
    'sb_secret_[A-Za-z0-9_-]{20,}'           # Supabase chave secreta
    'sbp_[a-f0-9]{40}'                       # Supabase Management API token
    'sk-[a-zA-Z0-9]{20,}'                    # OpenAI
    'sk_live_[a-zA-Z0-9]{24,}'               # Stripe Live
    'sk_test_[a-zA-Z0-9]{24,}'               # Stripe Test
    'pk_live_[a-zA-Z0-9]{24,}'               # Stripe Publishable Live
    'AKIA[0-9A-Z]{16}'                       # AWS Access Key
    '[a-zA-Z0-9]{32,45}'                     # Generic long key (careful)
    
    # Tokens
    'ghp_[a-zA-Z0-9]{36}'                    # GitHub Personal Token
    'gho_[a-zA-Z0-9]{36}'                    # GitHub OAuth Token
    'github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}'  # GitHub Fine-grained PAT
    'xox[baprs]-[0-9]{10,13}-[a-zA-Z0-9-]+'  # Slack Token
    
    # Supabase
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'  # JWT (Supabase anon/service keys)
    
    # Generic patterns
    'password\s*[:=]\s*["\x27][^"\x27]{8,}["\x27]'   # Password assignments
    'secret\s*[:=]\s*["\x27][^"\x27]{8,}["\x27]'     # Secret assignments
    'api[_-]?key\s*[:=]\s*["\x27][^"\x27]{16,}["\x27]'  # API key assignments
    'private[_-]?key'                         # Private key mentions
    'BEGIN RSA PRIVATE KEY'                   # RSA Private Key
    'BEGIN OPENSSH PRIVATE KEY'               # OpenSSH Private Key
)

# Files to exclude from scanning
EXCLUDE_PATTERNS=(
    '\.lock$'
    '\.min\.js$'
    '\.min\.css$'
    'node_modules'
    '\.git'
    'dist/'
    'build/'
    '\.env\.example'
    'types\.ts$'           # Supabase generated types
)

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || echo "")

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✅ No staged files to scan${NC}"
    exit 0
fi

FOUND_SECRETS=0
WARNINGS=()

for FILE in $STAGED_FILES; do
    # Skip excluded patterns
    SKIP=0
    for EXCLUDE in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$FILE" =~ $EXCLUDE ]]; then
            SKIP=1
            break
        fi
    done
    
    if [ $SKIP -eq 1 ]; then
        continue
    fi
    
    # Skip if file doesn't exist
    if [ ! -f "$FILE" ]; then
        continue
    fi
    
    # Scan file for each pattern
    for PATTERN in "${PATTERNS[@]}"; do
        MATCHES=$(grep -nE "$PATTERN" "$FILE" 2>/dev/null || true)
        if [ -n "$MATCHES" ]; then
            # Filter out false positives
            # Skip if it's referencing env variables properly
            if echo "$MATCHES" | grep -qE '(process\.env|Deno\.env|import\.meta\.env|VITE_)'; then
                continue
            fi
            
            # Skip example/placeholder values
            if echo "$MATCHES" | grep -qiE '(example|placeholder|your[-_]?key|xxx|test123)'; then
                continue
            fi
            
            WARNINGS+=("${RED}⚠️  Potential secret in $FILE:${NC}")
            WARNINGS+=("   Pattern: $PATTERN")
            WARNINGS+=("   $MATCHES")
            FOUND_SECRETS=$((FOUND_SECRETS + 1))
        fi
    done
done

# Report findings
if [ $FOUND_SECRETS -gt 0 ]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}🚨 POTENTIAL SECRETS DETECTED! Commit blocked.${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    for WARNING in "${WARNINGS[@]}"; do
        echo -e "$WARNING"
    done
    
    echo ""
    echo -e "${YELLOW}To fix this:${NC}"
    echo "  1. Remove the secret from the file"
    echo "  2. Use environment variables instead"
    echo "  3. Add the secret to Supabase Edge Function Secrets"
    echo ""
    echo -e "${YELLOW}If this is a false positive, you can bypass with:${NC}"
    echo "  git commit --no-verify"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ No secrets detected in staged files${NC}"
    exit 0
fi
