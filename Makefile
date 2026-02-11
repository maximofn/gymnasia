.PHONY: dev-api dev-web dev-mobile

dev-api:
	uvicorn app.main:app --reload --app-dir apps/api

dev-web:
	pnpm --filter web dev

dev-mobile:
	pnpm --filter mobile start
