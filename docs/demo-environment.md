# Ambiente público de demonstração

## Estado e escopo

Demo implantada no Render com PostgreSQL Neon separado do desenvolvimento. URLs, regiões, configuração e autorizações estão em [deployment.md](deployment.md). O template `deploy/render.demo.yaml` é referência para recriação; segredos não são versionados.

A demo é compartilhada e não tem identidade autenticada. Visitantes podem executar o Service Desk, inclusive resolver/reabrir chamados, e enxergar o histórico dos demais. Técnicos e ator são fictícios. Não inserir dados pessoais, corporativos ou confidenciais. Autenticação/RBAC permanecem no roadmap.

## Limites

| Proteção | Limite | Justificativa |
| --- | --- | --- |
| Tráfego por IP/rede IPv6 | 120 requisições/minuto, incluindo escritas | Navegação e atualizações de painel usam várias consultas; permite uso interativo com folga |
| Escritas | 30 tentativas/minuto por IP/rede IPv6 | Permite atribuir, pausar, resolver e reabrir; contém repetição rápida |
| Criação | 5 tentativas/15 minutos e 20/dia por IP/rede IPv6 | Um visitante consegue experimentar tipos/prioridades sem geração massiva |
| Escritas globais | 600 tentativas/dia | Cerca de 60 demonstrações de dez mudanças; contém abuso distribuído e crescimento do histórico |
| Capacidade | 200 chamados no banco exclusivo | Permite dashboard/filtros e limita volume; não representa garantia de tamanho exato em disco |
| Body | 128 KiB | Comporta os campos existentes mesmo com escape JSON, mantendo limite de transporte |

Quotas de escrita e criação usam janelas fixas UTC e contam tentativas, inclusive inválidas. Podem ocorrer rajadas nos limites das janelas. Limites compartilhados podem ser esgotados por um visitante; outro terá de aguardar. Capacidade é verificada dentro da transação de criação sob bloqueio, sem ultrapassagem por concorrência.

Leitura usa memória limitada do plugin Fastify e reinicia com o processo; é proteção de carga para uma instância, não quota durável. Escritas usam PostgreSQL e não são liberadas por reinício/redeploy. Respostas HTTP 429 incluem Retry-After; o frontend apresenta orientação de espera, sem reenviar escrita automaticamente. CORS expõe Retry-After à origem autorizada. Health/readiness estão isentos para monitoramento.

IPs não são gravados em texto no PostgreSQL: chaves usam HMAC-SHA256 com DEMO_IP_HASH_SECRET. IPv4 mapeado é normalizado e IPv6 agrupado por /64. Isso é pseudonimização, não anonimização; endereços são processados em memória e o provedor pode manter seus próprios logs. Contadores expirados são removidos na limpeza. Rotacionar o segredo reinicia a identidade das quotas individuais; o limite global permanece.

## Proxy e origem

TRUST_PROXY_HOPS permanece 0 por padrão local. Na implantação Render, usa 3 após diagnóstico da cadeia real e teste de cabeçalho forjado. Não usar trustProxy=true nem o primeiro valor X-Forwarded-For indiscriminadamente. Testar cabeçalho forjado e dois clientes distintos no ambiente real; se o caminho variar, substituir a política por lista de proxies confiáveis validada antes da abertura.

CORS usa origens exatas e escritas com Origin não autorizado recebem 403 no modo demo. Ausência de Origin não autentica ninguém: clientes fora do navegador continuam sujeitos às quotas. Não há promessa de proteção contra DDoS ou identidade por pessoa; redes NAT compartilham quotas.

## Vinculação do banco

A migration 007 cria apenas controles inertes: demo_environment, demo_tickets e demo_rate_windows. Não marca nem remove chamados existentes. Migrations anteriores são imutáveis.

O banco Neon implantado é novo e exclusivo. Em uma nova implantação, Após migrations e build, configurar NODE_ENV=production, DEMO_MODE=true, UUID exclusivo em DEMO_DATABASE_ID e segredo aleatório de no mínimo 32 caracteres. Executar explicitamente:

```sh
npm run demo:prepare -- --confirm-empty-demo-database
```

O comando exige banco sem chamados para a primeira vinculação, conexão remota com TLS verificado e confirmação textual. Depois é idempotente apenas para o mesmo UUID. A API falha ao iniciar em demo se a vinculação não corresponder. A criação registra demo_tickets na mesma transação de chamado/SLA/histórico.

## Retenção e exclusão

Prazo: mais de 48 horas desde created_at, independentemente do status. Tempo suficiente para retomar uma demonstração no dia seguinte; pendência/reabertura não estendem a retenção. Ao expirar, o chamado deixa de existir e de participar do dashboard, e seu detalhe retorna 404.

São removidos SOMENTE chamados presentes em demo_tickets com o UUID deste ambiente, e seus históricos, pausas e ciclos. Chamados não marcados são preservados, mesmo antigos. A rotina usa SQL fixo e transação; não faz TRUNCATE, DROP ou alterações de schema. Técnicos, categorias e schema_migrations permanecem. Sequências de numeração não são reiniciadas.

Quatro condições: DEMO_MODE=true, NODE_ENV=production, DEMO_CLEANUP_ENABLED=true e UUID correspondente em demo_environment. O parser rejeita limpeza em desenvolvimento ou fora de demo. Um banco real futuro não deve ser vinculado como public-demo nem reutilizar seu UUID.

Verificação no startup e no tráfego útil, limitada a uma vez por 15 minutos, com estado persistido no banco. Não é cron: a exclusão ocorre após 48h na próxima ativação/verificação, sem garantia de minuto exato. Se o Render estiver suspenso, a rotina não roda. Isso evita contratar cron e não depende de timer em memória para determinar idade dos dados. Linhas em edição são puladas e tentadas na próxima rodada. Exclusões são atômicas; falha reverte o conjunto.

## Segurança HTTP e logs

Helmet adiciona headers da API; CSP restritiva para respostas JSON, proteção contra framing e sniffing. Body limitado; erros 400/413/415/429 tratados sem stack. Logs de aplicação não incluem body, cabeçalhos, IP, query string, hostname ou credenciais; eventos registram operações e IDs. O provedor pode manter logs próprios que exigem revisão de retenção.

Frontend estático: headers aplicados no Render e CSP usando https://ramon-itops-api.onrender.com. Para recriação, preencher o template com a origem HTTPS real da API. Política sugerida: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src ORIGEM_REAL_DA_API; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'. Estilos inline são necessários às barras atuais dos gráficos. Não colar placeholder como política final.

## Cold start

No modo público, timeout de rede de 90s por tentativa; leituras transitórias podem repetir uma vez. Escritas nunca são repetidas automaticamente, pois a resposta pode se perder após persistência. Em falha incerta, conferir fila/chamado antes de reenviar. O aviso público informa dados temporários e primeira conexão mais lenta. O ambiente local mantém timeout de 10s.

## Recuperação

Em abuso persistente, suspender a demo pelo painel e investigar quotas; não aumentar limites automaticamente. Em falha de banco/limpeza, escritas falham sem ignorar proteção. Verificar secrets e identificação, status das migrations e readiness. Não habilitar limpeza em banco real para corrigir falta de espaço. Ao desativar a demo, desabilitar também a limpeza e revisar qualquer exposição sem autenticação.

A exclusão de dados demo expirados é intencional e não fornece histórico permanente. Não importar dados reais. Deploy público, TLS Neon, proxy e persistência após redeploy foram exercitados; resultados e limites estão em [validation.md](validation.md).
