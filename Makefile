.PHONY: env up down ps logs test lint build check

SECRETS := POSTGRES_PASSWORD TRACEFLOW_APP_DB_PASSWORD TRACEFLOW_RO_DB_PASSWORD TRACEFLOW_AUTH_DB_PASSWORD TRACEFLOW_SERVICE_TOKEN

# Create .env from the template, filling every empty secret with fresh random hex. Never overwrites.
env:
	@test ! -f .env || { echo ".env exists; not overwriting (move it aside to regenerate local secrets)"; exit 0; }; \
	while IFS= read -r line; do \
	  k=$${line%%=*}; \
	  case " $(SECRETS) " in *" $$k "*) [ "$${line#*=}" = "" ] && line="$$k=$$(openssl rand -hex 32)";; esac; \
	  printf '%s\n' "$$line"; \
	done < .env.example > .env && echo "wrote .env"

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
