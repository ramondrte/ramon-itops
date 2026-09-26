# Regras do Ramon ITOps

- Evoluir por fases pequenas e explicar mudanças maiores antes de executá-las.
- Preservar o foco em Suporte, Infraestrutura, NOC, Governança de TI e ITSM.
- Usar TypeScript, nomes claros e a organização apps/web, apps/api, packages/database e docs.
- Não adicionar tecnologia ou dependência sem justificar sua necessidade.
- Documentar regras de negócio e decisões arquiteturais junto da alteração.
- Nunca usar dados reais, segredos ou credenciais corporativas. Não versionar .env.
- Não usar identidade Git corporativa; verificar a identidade pessoal antes de commits.
- Antes de publicar: npm run lint, npm run typecheck, npm test e npm run build.
- Testar comportamento relevante, incluindo falhas de dependências. Não alegar validações não executadas.
- Manter README e runbook coerentes com comandos e comportamento atuais.
- Não apresentar indicadores planejados como dados reais.
- Não apagar volumes ou executar migrações destrutivas sem autorização específica.
- Explicar como a entrega demonstra competências em uma entrevista técnica.
- Autenticação, autorização e implantação precisam de planejamento antes de exposição em produção.

## Service Desk

- Alterações de schema somente por novas migrations versionadas; não editar migrations aplicadas.
- Gravar atualização e histórico na mesma transação.
- Preservar controle de versão no PATCH e regras documentadas de transição.
- Rodar npm run test:integration com TEST_DATABASE_URL em banco dedicado terminado em _test antes de publicar alterações de persistência.
- Não apresentar o ator de demonstração como identidade autenticada.
- Preservar os health checks e a separação entre rotas, serviço e repositório.
