#!/bin/bash

# Get list of staged files
staged_files=$(git diff --cached --name-only)

# Check which workspaces are affected
has_server=false
has_client=false

if echo "$staged_files" | grep -q "^server/"; then
  has_server=true
fi

if echo "$staged_files" | grep -q "^client/"; then
  has_client=true
fi

# Output workspaces
if [ "$has_server" = true ]; then
  echo "server"
fi

if [ "$has_client" = true ]; then
  echo "client"
fi
