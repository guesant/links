set shell := ["sh", "-eu", "-c"]

compose := "docker compose --file .config/compose.yaml run --rm --build"
runner := if env("LINKS_CONTAINER", "") == "1" { "" } else { compose + " workspace" }
server := if env("LINKS_CONTAINER", "") == "1" { "" } else { compose + " --service-ports workspace" }

default:
    @just --list

dev:
    {{ server }} node .config/scripts/tasks.mjs dev

build:
    {{ runner }} node .config/scripts/tasks.mjs build

check:
    {{ runner }} node .config/scripts/tasks.mjs check

format:
    {{ runner }} node .config/scripts/tasks.mjs format

format-fix:
    {{ runner }} node .config/scripts/tasks.mjs format-fix

test:
    {{ runner }} node .config/scripts/tasks.mjs test

stats:
    {{ runner }} node .config/scripts/update-stats.mjs

icons:
    {{ runner }} node .config/scripts/generate-icons.mjs

links:
    {{ runner }} node .config/scripts/verify-links.mjs

preview:
    {{ server }} node .config/scripts/tasks.mjs preview

shell:
    {{ runner }} bash
