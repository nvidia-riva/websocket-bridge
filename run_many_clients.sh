#!/usr/bin/env bash
set -euo pipefail

parallel -j0 -N0 node ./modules/audiocodesClient.js ::: {1..100}
