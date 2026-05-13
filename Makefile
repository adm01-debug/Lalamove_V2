# Makefile - Lalamove Guardian

.PHONY: help dev start stop logs test backup clean deploy

help: ## Mostrar ajuda
	@echo "Comandos disponíveis:"
	@echo "  make dev      - Rodar em desenvolvimento"
	@echo "  make start    - Iniciar Supabase local"
	@echo "  make stop     - Parar Supabase local"
	@echo "  make logs     - Ver logs"
	@echo "  make test     - Rodar testes"
	@echo "  make backup   - Backup do banco"
	@echo "  make clean    - Limpar dados locais"
	@echo "  make deploy   - Deploy para produção"

dev: ## Desenvolvimento
	npm run dev

start: ## Iniciar Supabase
	supabase start

stop: ## Parar Supabase
	supabase stop

logs: ## Ver logs
	supabase logs

test: ## Rodar testes
	npm run build

backup: ## Backup
	./scripts/backup.sh

clean: ## Limpar
	supabase stop --no-backup
	rm -rf .supabase

deploy: ## Deploy
	./scripts/deploy.sh

db-reset: ## Reset database
	supabase db reset

db-migrate: ## Criar migration
	@read -p "Migration name: " name; \
	supabase migration new $$name
