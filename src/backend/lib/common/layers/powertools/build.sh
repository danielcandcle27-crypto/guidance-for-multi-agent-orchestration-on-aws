#!/bin/bash
set -e

LAYER_DIR="$(dirname "$0")"
TARGET_DIR="${LAYER_DIR}/python/lib/python3.12/site-packages"

# Create the directory structure
mkdir -p "${TARGET_DIR}"

# Install dependencies into the target directory
pip install -r "${LAYER_DIR}/python/requirements.txt" -t "${TARGET_DIR}"

echo "Lambda layer built successfully at ${TARGET_DIR}"
