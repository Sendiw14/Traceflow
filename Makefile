.PHONY: env up down ps logs test lint build check

# Create .env from the template with a fresh random service token. Never overwrites.
env:
	@test ! -f .env || { echo ".env exists; not overwriting"; exit 0; }; \
	sed "s/^TRACEFLOW_SERVICE_TOKEN=$$/TRACEFLOW_SERVICE_TOKEN=$$(openssl rand -hex 32)/" .env.example > .env && \
	echo "wrote .env"

up:
	docker compose up -d --build --wait

down:
	docker compose down

ps:
	docker compose ps

logs:
	docker compose logs --tail=100

test:
	cd services/trace-api && go test -race ./...

lint:
	cd services/trace-api && test -z "$$(gofmt -l .)" && go vet ./...
	pnpm --package=@redocly/cli@2 dlx redocly lint api/openapi.yaml
	docker run --rm -v "$$PWD/infra/otel/collector.yaml:/c.yaml:ro" otel/opentelemetry-collector-contrib:0.165.0 validate --config=/c.yaml

build:
	cd services/trace-api && go build -o bin/trace-api ./cmd/server

check: lint test build
