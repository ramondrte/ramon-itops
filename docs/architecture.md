# Arquitetura da Fase 1

Fluxo local: navegador → Vite /api → Fastify → pool PostgreSQL → PostgreSQL em Docker.

React + Vite atende uma interface interna sem necessidade inicial de renderização no servidor. Fastify concentra rotas, logs estruturados e encerramento do serviço. npm workspaces mantém um único lockfile. O pacote database isola acesso ao PostgreSQL com pg; não há ORM ou tabelas de negócio nesta fase.

## Contratos de saúde

| Rota | Resultado | Significado |
| --- | --- | --- |
| GET /health | 200, status ok | API responde, independentemente do banco |
| GET /health/ready | 200, status ready, database up | Consulta SELECT 1 executada |
| GET /health/ready | 503, status not_ready, database down | Banco indisponível ou consulta falhou |

Liveness não depende do banco para evitar confundir falha da dependência com queda do processo. Readiness permite que operações identifique degradação. Erros não retornam detalhes da conexão. O pool limita conexões e usa timeouts; sinais de encerramento fecham o pool.

O health check do Compose confirma que PostgreSQL aceita conexões; o da API verifica também o acesso pela aplicação. A interface mostra banco indisponível quando não consegue confirmar sua prontidão, inclusive se a API cair. Essa limitação aparece na tela.

## Configuração e segurança

API e PostgreSQL vinculados ao loopback. O proxy do Vite evita CORS no desenvolvimento e mantém credenciais no backend. O frontend não recebe DATABASE_URL. Arquivo .env ignorado, exemplo com valores locais. Volume nomeado persiste o banco. Mudanças no pacote database exigem novo build e reinício da API durante desenvolvimento.

## Próximas fases

Migrações SQL versionadas e modelo de chamados entrarão junto da primeira funcionalidade de Service Desk. Antes de exposição externa: autenticação, autorização, TLS, configuração de deploy, política de logs, backups e restauração. A Fase 1 não provisiona esses recursos.
