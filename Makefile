.PHONY: dev dev-api dev-web dev-mobile

dev:
	./scripts/dev-all.sh

dev-api:
	uvicorn app.main:app --reload --app-dir apps/api

dev-web:
	pnpm --filter web dev

dev-mobile:
	pnpm --filter mobile start
