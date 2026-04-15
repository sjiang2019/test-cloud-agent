.PHONY: install install-backend install-frontend dev backend frontend docker-up docker-down docker-build

install: install-backend install-frontend

install-backend:
	cd backend && poetry install

install-frontend:
	cd frontend && npm install

dev:
	$(MAKE) backend & $(MAKE) frontend & wait

backend:
	cd backend && poetry run uvicorn app.main:app --reload

frontend:
	cd frontend && npm start

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose up -d --build
