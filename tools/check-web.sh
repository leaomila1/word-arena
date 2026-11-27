#!/bin/sh
# Syntax-check every frontend ES module (vendor excluded). Exit 1 on the first error.
cd "$(dirname "$0")/../web" || exit 1
find . -name '*.js' -not -path './vendor/*' | while read -r f; do node --experimental-default-type=module --check "$f" || exit 1; done
