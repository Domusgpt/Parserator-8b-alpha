#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETPLACE_DIR="${SCRIPT_DIR}/dev-marketplace"
PLUGIN_DIR="${MARKETPLACE_DIR}/parserator-lean-orchestration"
DIST_DIR="${SCRIPT_DIR}/dist"

if ! command -v node >/dev/null 2>&1; then
  echo "\"node\" is required to package the plugin." >&2
  exit 1
fi

VERSION="$(node -e "console.log(require('${PLUGIN_DIR}/.claude-plugin/plugin.json').version)")"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_NAME="parserator-lean-orchestration-${VERSION}.tar.gz"
RELEASE_NOTES="${DIST_DIR}/parserator-lean-orchestration-${VERSION}-RELEASE_NOTES.md"

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# Create archive relative to the marketplace root so Claude can resolve manifests.
tar -czf "${DIST_DIR}/${ARCHIVE_NAME}" -C "${MARKETPLACE_DIR}" parserator-lean-orchestration

echo "# Parserator Lean Orchestration Plugin" > "${RELEASE_NOTES}"
echo "*Version:* ${VERSION}" >> "${RELEASE_NOTES}"
echo "" >> "${RELEASE_NOTES}"
echo "Packaged on ${TIMESTAMP} UTC." >> "${RELEASE_NOTES}"
echo "" >> "${RELEASE_NOTES}"
echo "## Highlights" >> "${RELEASE_NOTES}"
echo "- Snapshot-driven readiness checks via /parserator-status" >> "${RELEASE_NOTES}"
echo "- Guarded lean parse execution through /parserator-parse (blocks on investigation actions unless --force is supplied)" >> "${RELEASE_NOTES}"
echo "- Helper scripts for CI and local smoke tests" >> "${RELEASE_NOTES}"
echo "" >> "${RELEASE_NOTES}"
echo "## Submission Steps" >> "${RELEASE_NOTES}"
echo "1. Upload ${ARCHIVE_NAME} to the target Claude marketplace." >> "${RELEASE_NOTES}"
echo "2. Paste the contents of this file into the release notes field." >> "${RELEASE_NOTES}"
echo "3. Attach docs/LEAN_PLUGIN_RUNBOOK.md for on-call readiness and docs/PLUGIN_LAUNCH_PLAN.md for launch context." >> "${RELEASE_NOTES}"
echo "4. After approval, announce availability in the operations channel with the latest readiness snapshot." >> "${RELEASE_NOTES}"

echo "Packaged ${ARCHIVE_NAME} with release notes at ${RELEASE_NOTES}."
echo "Next steps: submit the archive to your Claude marketplace and share the runbook with on-call teams."
