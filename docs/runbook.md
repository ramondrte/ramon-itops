# Runbook operacional

## Inicialização

1. Instalar Node.js 22, npm e Docker com Compose v2.
2. Copiar .env.example para .env e executar npm ci na raiz.
3. Executar npm run db:up; aguardar o banco saudável.
4. Executar npm run dev e abrir http://localhost:5173.
5. Confirmar /health e /health/ready e atualizar o status na interface.

## Diagnóstico

| Sintoma | Verificação | Próxima ação |
| --- | --- | --- |
| Frontend não abre | Saída do terminal; porta 5173 | Resolver processo conflitante e iniciar novamente |
| API indisponível | curl -i http://127.0.0.1:3001/health | Conferir terminal da API, .env e API_PORT |
| API disponível, banco indisponível | docker compose ps; docker compose logs --tail=50 database | Confirmar container, credenciais e DATABASE_URL |
| Porta 5432 ocupada | Verificar outro PostgreSQL local | Ajustar porta publicada e DATABASE_URL em conjunto |
| Docker não encontrado | docker version; docker compose version | Instalar/iniciar Docker e repetir db:up |
| Credenciais alteradas não funcionam | Volume já inicializado | Usar credenciais anteriores ou alterar usuário no banco; não apagar volume para “corrigir” |

Os logs da API são JSON no terminal, com identificador de requisição. Não anexar .env, senhas ou dados reais em relatos de falha.

## Exercício controlado de indisponibilidade

Com o ambiente local iniciado:

```sh
docker compose stop database
curl -i http://127.0.0.1:3001/health
curl -i http://127.0.0.1:3001/health/ready
```

Esperado: 200 no primeiro, 503 no segundo. Atualizar a interface deve mostrar API disponível e banco indisponível.

```sh
docker compose start database
```

Aguardar saúde em docker compose ps. Readiness deve voltar a 200 sem reiniciar a API. Atualizar a interface confirma recuperação.

## Encerramento

Ctrl+C nas aplicações e npm run db:down. O volume persiste. Não executar down com remoção de volumes: isso apaga os dados locais.

## Limitação

Este runbook cobre desenvolvimento local; backup, restauração, alertas automáticos e resposta a incidentes de produção serão planejados posteriormente.
