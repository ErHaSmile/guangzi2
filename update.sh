#!/usr/bin/env bash
# Convenience wrapper — always run from app root
exec "$(cd "$(dirname "$0")" && pwd)/scripts/server-update.sh"
