#!/bin/bash

# Build Docker image with environment variables from .env.local
# Usage: ./docker-build.sh

if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found"
    echo "Please create .env.local file with required environment variables"
    exit 1
fi

# Read .env.local and convert to --build-arg format
BUILD_ARGS=""
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ ! $key =~ ^#.* ]] && [ -n "$key" ]; then
        # Remove quotes if present
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        BUILD_ARGS="$BUILD_ARGS --build-arg $key=\"$value\""
    fi
done < .env.local

# Build the image
echo "Building Docker image with environment variables..."
eval "docker build $BUILD_ARGS -t app-chat-fe ."

echo ""
echo "Build complete! Run the container with:"
echo "docker run -p 8080:8080 --env-file .env.local app-chat-fe"
