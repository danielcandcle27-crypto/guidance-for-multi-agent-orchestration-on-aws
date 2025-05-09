#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}CDK Nag Scan Script${NC}"
echo -e "${CYAN}===================${NC}"

# Store the directory of this script
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
INFRA_DIR="$SCRIPT_DIR/packages/infra"

# Check if the infra directory exists
if [ ! -d "$INFRA_DIR" ]; then
    echo -e "${RED}Error: Infrastructure directory not found at $INFRA_DIR${NC}"
    echo -e "${YELLOW}Make sure you are running this script from the project root directory.${NC}"
    exit 1
fi

# Navigate to the infra directory
echo -e "${BLUE}Changing to directory: $INFRA_DIR${NC}"
cd "$INFRA_DIR" || {
    echo -e "${RED}Error: Could not change to directory $INFRA_DIR${NC}"
    exit 1
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js to run this script.${NC}"
    exit 1
fi

# Check if the run-cdk-nag.js script exists
if [ ! -f "scripts/run-cdk-nag.js" ]; then
    echo -e "${RED}Error: CDK Nag script not found at scripts/run-cdk-nag.js${NC}"
    exit 1
fi

# Run the CDK nag script
echo -e "${BLUE}Running CDK nag scan...${NC}"
node scripts/run-cdk-nag.js

# Capture the exit code from the Node.js script
RESULT=$?

# Output completion message based on exit code
if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}CDK nag scan completed successfully.${NC}"
else
    echo -e "${YELLOW}CDK nag scan completed with warnings or errors. Please review the output above.${NC}"
fi

# Return the exit code from the Node.js script
exit $RESULT
