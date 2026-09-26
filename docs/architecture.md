# Arquitetura e decisões

## Fluxo

Navegador → React Router/Vite → proxy /api → Fastify → serviço de chamados → repositório SQL → PostgreSQL 17.

npm workspaces mantém apps/web, apps/api e packages/database com um lockfile. React Router organiza as páginas e mantém filtros na URL. O frontend usa fetch; não foi adicionada biblioteca de estado global.

## Organização do backend

- Rotas: contrato HTTP, schemas e logs de operação.
- Serviço: transições, requisitos de atendimento, normalização e histórico.
- Repositório: SQL parametrizado e mapeamento dos registros.
- Database: pool, transações e ferramentas de migrations.

SQL direto com pg aproveita a dependência existente e torna consultas e transações explícitas. O tamanho do domínio ainda não justifica ORM ou query builder. Identificadores dinâmicos de filtros são escolhidos de uma lista fixa; valores enviados pelo usuário são parâmetros SQL.

## Consistência

Criação e atualização ocorrem junto da gravação do histórico na mesma transação. Uma falha em qualquer etapa reverte o conjunto. PATCH bloqueia a linha durante a transação e compara a versão enviada; edição desatualizada retorna 409. No-op não altera versão ou data nem cria evento (chamados resolvidos exigem reabertura antes de alterações).

Listagem com contagem e detalhe com histórico usam uma visão consistente da transação. Datas são timestamptz, serializadas em ISO pela API e exibidas no fuso do navegador. Eventos com o mesmo horário são ordenados também por ID.

## Modelo

categories → tickets ← technicians; tickets → ticket_history. O solicitante é um nome de exibição, não uma conta. Técnico não possui login. O ator do histórico é um identificador fixo de demonstração, não uma identidade autenticada.

ID UUID interno; sequence_number bigint único gera INC/REQ com mínimo de seis dígitos, sem truncar números maiores. A sequência é compartilhada, pode conter lacunas e não é usada como métrica de volume. Tipo e solicitante são fixos nesta etapa.

## Migrations

001 cria catálogos, chamados, restrições e índices. 002 cria histórico. 003 cadastra as sete categorias. O executor mantém schema_migrations, verifica checksums e usa advisory lock para serializar execuções. Cada arquivo é transacional. Migrations já aplicadas são imutáveis; novas mudanças exigem novo arquivo. Não há alterações de schema automáticas ao subir a API nem rollback destrutivo automático.

O seed de técnicos fictícios é separado e repetível. Não contém alterações de schema nem chamados de exemplo.

## Saúde e limites

GET /health continua independente do banco. GET /health/ready executa SELECT 1 e retorna 503 em falha. O health check do Compose verifica disponibilidade do servidor PostgreSQL; readiness não substitui a execução das migrations.

API, Vite e banco vinculados ao loopback. Sem autenticação, autorização, notificações ou SLA. A API não deve ser exposta em produção nessa condição. Logs registram IDs e operações, sem copiar descrição ou solicitante.

## Referência da dependência adicionada

[React Router: navegação declarativa](https://reactrouter.com/start/declarative/routing).
