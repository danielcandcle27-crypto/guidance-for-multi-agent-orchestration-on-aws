#!/bin/bash

# This script provides a workaround for CDK types incompatibility issues
# by using the --transpile-only flag with ts-node

# Pass all arguments to ts-node with the transpile-only flag
npx ts-node --transpile-only "$@"