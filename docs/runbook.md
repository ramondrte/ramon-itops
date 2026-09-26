# Runbook operacional

## Subir o ambiente

1. Usar Node.js 22, npm e Docker com Compose v2.
2. Na raiz: cp .env.example .env e npm ci.
3. Executar npm run db:up e aguardar o banco saudável.
4. Executar npm run db:migrate e conferir npm run db:migrate:status.
5. Opcional: npm run db:seed:demo para os dois técnicos fictícios.
6. Executar npm run dev e abrir http://localhost:5173/tickets.

Todos os arquivos SQL devem passar pelo executor. Não modificar schema por console SQL nem editar migrations aplicadas. O executor verifica checksum e serializa execuções simultâneas.

## Exercício funcional

Abrir incidente fictício → atribuir técnico → iniciar atendimento → marcar pendência com motivo → resolver com solução → reabrir com justificativa. Conferir os eventos da timeline, datas e versão. Abrir uma solicitação para verificar prefixo REQ. Testar filtros combinados na fila.

## Diagnóstico

| Sintoma | Verificação | Ação |
| --- | --- | --- |
| Frontend não abre | Terminal; porta 5173 | Resolver conflito e iniciar novamente |
| API não responde | GET /health; terminal da API | Conferir API_PORT e .env |
| Banco indisponível | docker compose ps; docker compose logs --tail=50 database | Iniciar container e conferir DATABASE_URL |
| Saúde OK, chamados falham | npm run db:migrate:status | Aplicar migrations pendentes |
| Lista sem técnicos | GET /technicians | Executar seed de demonstração |
| Erro 409 ao salvar | Versão desatualizada | Recarregar, revisar alterações atuais e reaplicar a intenção |
| Erro de checksum | Migration aplicada foi editada | Restaurar arquivo original; criar nova migration para correção |
| Credenciais alteradas não funcionam | Volume já inicializado | Ajustar acesso ao banco existente; não apagar volume |

Logs da API são enviados ao terminal. Usar identificador de requisição e ID do chamado ao investigar. Não anexar .env ou dados reais.

## Indisponibilidade e recuperação local

```sh
docker compose stop database
curl -i http://127.0.0.1:3001/health
curl -i http://127.0.0.1:3001/health/ready
docker compose start database
```

Durante a falha, esperado 200 em liveness e 503 em readiness. Após o banco voltar, readiness e consulta dos chamados devem recuperar sem reiniciar a API. Recarregar a interface e confirmar que o chamado e sua timeline persistiram.

## Testes de integração

Criar banco dedicado ramon_itops_test com createdb (comando no README). Definir TEST_DATABASE_URL e executar npm run test:integration. Os testes criam e removem seu próprio schema; não limpam o banco de demonstração.

## Encerramento

Ctrl+C nas aplicações e npm run db:down. Dados permanecem no volume. Não usar remoção de volumes como procedimento de diagnóstico.

Backup/restauração, autenticação, autorização e implantação de produção ainda precisam de planejamento.

## Implantação da Fase 3

1. Faça backup do banco e interrompa a API antes de aplicar as migrations 004–006; a migration 005 marca o início real do acompanhamento legado e bloqueia escritas concorrentes em tickets durante sua execução.
2. Execute `npm run db:migrate` e `npm run db:migrate:status`; confirme seis migrations aplicadas, sem editar os arquivos antigos.
3. Inicie a API atualizada e confira `/health`, `/health/ready`, um chamado legado e `/metrics/overview?period=all`.
4. Confirme cobertura parcial e timestamp do legado ativo, ausência de SLA fictício nos já resolvidos e exclusões nos indicadores.

Para exercitar persistência, coloque um chamado fictício em Pendente, anote `consumed_ms`, `remaining_ms` e `paused_at`, reinicie API/banco e consulte novamente. O saldo deve permanecer congelado. Retome e confirme novo prazo. Não remova volumes. Indisponibilidade não pausa chamados em atendimento; apenas Pendente pausa SLA. Mantenha relógio do servidor sincronizado.

Em falha, não reative código antigo para escrever no schema já migrado: ele não manteria os ciclos. Preserve backup e utilize correção versionada; não há downgrade automático/destrutivo. Build e todos os testes devem preceder publicação.

## Porta alternativa do PostgreSQL local

Se já existir banco na porta 5432, mantenha-o preservado. Configure POSTGRES_PORT=55432 e DATABASE_URL com a mesma porta no .env antes de subir o Compose. Um projeto Compose separado (`docker compose -p ramon-itops-validation`) usa volume próprio. Não execute down -v em bancos que precise preservar.

O fluxo inicial é copiar .env.example apenas se .env não existir, executar npm ci, db:up, db:migrate, db:seed:demo e npm run dev. Produção possui outro ciclo de configuração e migrations: [deployment.md](deployment.md).

## Ambiente validado neste computador

Docker Desktop instalado e funcional. A validação utiliza projeto `ramon-itops-validation`, volume separado e PostgreSQL em 55432. O banco anterior em 5432 não foi migrado nem substituído. Para consultar: `POSTGRES_PORT=55432 docker compose -p ramon-itops-validation ps`. A aplicação de validação foi iniciada com API_PORT=3002, WEB_PORT=5174 e DATABASE_URL apontando para 55432. Os padrões 3001/5173 permanecem disponíveis no ambiente original.

Após decidir pela migração definitiva do desenvolvimento para Docker, planeje exportação/importação dos dados fictícios e atualização de .env; não execute dois bancos na mesma porta nem remova o volume anterior.
