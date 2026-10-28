set shell := ["sh", "-eu", "-c"]

compose := "docker compose --file .config/compose.yaml run --rm --build"
runner := if env("LINKS_CONTAINER", "") == "1" { "" } else { compose + " workspace" }
server := if env("LINKS_CONTAINER", "") == "1" { "" } else { compose + " --service-ports workspace" }

default:
    @just --list

dependencies:
    {{ runner }} npm ci

dev: dependencies
    {{ server }} node .config/scripts/tasks.mjs dev

build: dependencies
    {{ runner }} node .config/scripts/tasks.mjs build

check: dependencies
    {{ runner }} node .config/scripts/tasks.mjs check

format: dependencies
    {{ runner }} node .config/scripts/tasks.mjs format

format-fix: dependencies
    {{ runner }} node .config/scripts/tasks.mjs format-fix

test: dependencies
    {{ runner }} node .config/scripts/tasks.mjs test

lint: dependencies
    {{ runner }} npm run lint

typecheck: dependencies
    {{ runner }} npm run check

stats: dependencies
    {{ runner }} node .config/scripts/update-stats.mjs

icons: dependencies
    {{ runner }} node .config/scripts/generate-icons.mjs

links: dependencies
    {{ runner }} node .config/scripts/verify-links.mjs

preview: dependencies
    {{ server }} node .config/scripts/tasks.mjs preview

shell:
    {{ runner }} bash
