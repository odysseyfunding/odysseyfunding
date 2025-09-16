#!/usr/bin/env bash
set -euo pipefail

# Simple structured decision logger
# Usage:
#   scripts/log_decision.sh -t "Title" -b "Body/context" -g "tag1,tag2"

TITLE=""
BODY=""
TAGS=""

while getopts ":t:b:g:" opt; do
  case ${opt} in
    t)
      TITLE=${OPTARG}
      ;;
    b)
      BODY=${OPTARG}
      ;;
    g)
      TAGS=${OPTARG}
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

if [[ -z "${TITLE}" ]]; then
  echo "Title is required. Use -t \"Your title\"" >&2
  exit 1
fi

UTC_DATE=$(date -u +%F)
UTC_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOC_DIR="/workspace/docs"
DOC_FILE="${DOC_DIR}/chat-history-${UTC_DATE}.md"

mkdir -p "${DOC_DIR}"

if [[ ! -f "${DOC_FILE}" ]]; then
  echo "# Chat History ${UTC_DATE} (UTC)" > "${DOC_FILE}"
  echo >> "${DOC_FILE}"
fi

{
  echo "## ${TITLE}"
  echo "- **time_utc**: ${UTC_TS}"
  if [[ -n "${TAGS}" ]]; then
    echo "- **tags**: ${TAGS}"
  fi
  if [[ -n "${BODY}" ]]; then
    echo
    echo "${BODY}"
  fi
  echo
} >> "${DOC_FILE}"

echo "Logged: ${TITLE} -> ${DOC_FILE}"

