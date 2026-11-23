# 00 — Resumo para o dono

Auditoria de QA do Lalamove V2, somente leitura, sobre o commit `281cd07` (`main` de 22/11/2026 22:42 UTC).
Nada foi corrigido nesta sessão: o resultado é este diagnóstico e o plano de 300 etapas em `04-PLANO.md`,
escrito para outro agente executar sozinho.

## Estado geral, sem rodeios

O sistema está longe de "80% pronto" no quesito que mais importa: **controle de acesso e confiança no
dado**. A interface está rica e bem acabada, os fluxos existem e a maior parte do código é cuidadosa —
há testes, guardas, documentação e padrões bons no repositório. O problema está nas camadas que o usuário
não vê: as regras que dizem quem pode o quê foram afrouxadas no passado para resolver erros de tela e
nunca foram refechadas; várias funções de servidor confiam no que o navegador manda; e vários painéis
exibem número que não vem de cálculo nenhum.

Três frases resumem o risco:

1. **A chave de produção da Lalamove está publicada na internet** — o repositório está público e a chave
   está em texto puro em 10 arquivos. Isso custa dinheiro hoje, não "se alguém descobrir".
2. **Qualquer pessoa com login pode virar administradora** — e a mesma alteração que abriu isso já deu
   papel de administrador a todos os usuários que existiam na época.
3. **Pedido pode ser cobrado na Lalamove e não existir no sistema** — para quase todos os tipos de
   serviço, a gravação falha em silêncio e a tela mostra sucesso.

Nada disso é opinião: cada item tem arquivo e linha em `03-ACHADOS.md`, e cada achado foi relido por um
segundo revisor independente, que tentou derrubá-lo antes de ele entrar na lista.

## Os 10 maiores riscos, em linguagem de negócio

**1. A chave da sua conta Lalamove está publicada na internet.**
A chave de API e a senha de assinatura da Lalamove **de produção** estão escritas, em texto puro, em 10
arquivos na pasta principal do repositório — e o repositório está **aberto ao público** no GitHub. Com
isso, qualquer pessoa cria e cancela fretes pagos na sua conta, e também consegue fingir ser a Lalamove
mandando avisos falsos de entrega para o seu sistema. É o item mais urgente de todos: **trocar essas duas
credenciais no painel da Lalamove hoje**. Apagar os arquivos depois não resolve sozinho — quem já copiou
continua com elas.

**2. Qualquer pessoa com login no sistema pode se tornar administradora.**
A regra de acesso da tabela de papéis foi aberta em agosto para resolver um erro de tela e nunca foi
fechada. Hoje um usuário de simples consulta consegue, em um comando, se promover a administrador — e
também mudar o papel de qualquer colega. Pior: a mesma alteração deu papel de administrador a **todos os
usuários que existiam na época**. Enquanto isso não for corrigido, não existe controle de permissão
nenhum, só a aparência dele nas telas.

**3. A lista de motoristas, com telefone, está aberta sem login.**
Um atalho de desempenho criou uma cópia da tabela de motoristas (nome, telefone, veículo e a classificação
interna de risco, inclusive quem está em lista negra) e liberou leitura para visitantes **sem login**.
Qualquer pessoa na internet baixa essa lista. É exposição de dado pessoal, com risco de LGPD.

**4. Pedido cobrado na Lalamove que não existe no seu sistema.**
Quando o operador escolhe quase qualquer tipo de serviço (só "CAR" e "VAN" escapam), o pedido é criado e
**cobrado** na Lalamove, mas a gravação no banco falha — e o sistema não avisa nada, nem registra o erro.
Resultado: frete pago, sem rastreamento, sem aviso ao motorista, sem conferência de cobrança. A tela mostra
sucesso.

**5. Funções de servidor que deveriam ser administrativas aceitam qualquer usuário logado.**
A função que cria, cancela e troca motorista de pedidos não verifica papel nenhum: um usuário de consulta
faz tudo o que um gestor faz. Duas outras decidem o papel lendo um campo que **o próprio usuário consegue
editar**. E duas funções de manutenção, que reescrevem as regras de acesso do banco com poder máximo,
estão publicadas sem qualquer verificação — e são republicadas a cada mudança no código.

**6. O cancelamento de pedido não funciona de ponta a ponta.**
A tela pede motivo, observação e quem cancelou — nada disso é gravado. Pior: o sistema tenta gravar o
status como `CANCELED`, e o banco só aceita `CANCELLED`. A gravação inteira é recusada, o pedido continua
aparecendo como ativo e a tela devolve erro. O mesmo tipo de divergência de grafia aparece em cinco
vocabulários de status diferentes misturados no histórico.

**7. Vários painéis mostram números inventados ou truncados.**
Saúde do sistema exibe tempo de atividade e conexões de banco fixos no código; o painel de Analytics mostra
variações percentuais ("+12%", "-15%") que não vêm de cálculo nenhum; "total de motoristas" vem de uma
consulta limitada a 10; totais e exportações são somados no navegador sobre uma página incompleta dos
dados. Em decisões de operação, isso é pior que não ter painel.

**8. A rede de proteção automática não protege.**
O repositório tem 29 verificações automáticas prontas (segredo no pacote, segurança das telas, limites de
desempenho, consistência de tradução). **Só uma** roda de verdade na integração contínua. A que vigia as
configurações do GitHub ainda dá "tudo certo" quando não consegue autenticar — foi assim que o repositório
voltar a ser público passou em branco. E o teste que deveria provar que papel e MFA funcionam fica verde
sem rodar esses casos.

**9. A fila de trabalhos e os avisos ao motorista têm caminhos que terminam em nada.**
Os botões "Processar agora" e "Deletar" da fila mostram mensagem de sucesso e não fazem nada. Jobs de
e-mail, WhatsApp e Slack são marcados como concluídos sem nunca entregar. O opt-out (pedido de não receber
mensagem) é respeitado em um canal e furado no canal de contingência. A renovação automática do token de
uma das integrações nunca renova nada.

**10. O sistema avisa pouco quando algo dá errado.**
Falha de consulta aparece como "nenhum registro" em várias telas; erro de permissão derruba o usuário numa
página de "sem acesso" sem explicar nem permitir tentar de novo; o download de comprovante falha calado;
e a integração contínua da `main` está vermelha há três execuções enquanto as instruções internas do
projeto afirmam, por escrito, que está verde — o que faz o próximo agente trabalhar sobre uma base quebrada.

## Contagem por severidade

| Severidade | O que significa | Achados |
|---|---|---|
| **Crítica** | perda ou vazamento de dado, falha de segurança, fluxo principal quebrado | **13** |
| **Alta** | função importante falha ou dá resultado errado | **60** |
| **Média** | funciona com defeito ou fragilidade | **146** |
| **Baixa** | acabamento e higiene | **63** |
| | **Total** | **282** |

Os 282 achados estão organizados em **24 causas raiz** no `03-ACHADOS.md` — 245 deles cabem numa dessas
24 causas, o que é a informação mais útil deste relatório: não são 282 problemas independentes, são
cerca de duas dezenas de decisões que se repetiram. As quatro maiores: regra de acesso do banco
afrouxada para destravar tela e nunca refechada (12 achados); função de servidor que exige login mas
nunca confere o papel (13); valor gravado que o banco não aceita, por falta de uma tradução única de
status (13); e número de painel calculado no navegador sobre uma fatia dos dados, com uma fórmula por
tela (18). O restante vem agrupado por camada.

Mais 6 achados foram **levantados e depois refutados** pela segunda leitura — estão listados no fim de
`03-ACHADOS.md`, com o motivo, para não serem reabertos por engano. E 34 achados duplicados (o mesmo
defeito visto por dois ângulos) foram **fundidos** no achado de origem, em vez de contados duas vezes.

## O plano

**300 etapas**, numeradas de 001 a 300, em 8 ondas: 1 segurança e risco de perda de dado · 2 fluxos
principais quebrados · 3 integridade de dados e regras de negócio · 4 funcionalidades incompletas ·
5 robustez · 6 performance · 7 experiência de uso · 8 higiene.

Cada etapa é uma mudança pequena, com uma PR própria e uma verificação concreta — comando, consulta ou
request, com o resultado esperado escrito. **80 etapas param e esperam sua aprovação** antes do merge:
são as que mexem em migration de produção, CI, segredo, infraestrutura, deleção de dado, arquitetura ou
custo.

### As 5 primeiras coisas, em ordem

| # | O que | Por que agora | Quem faz |
|---|---|---|---|
| 1 | Rotacionar a chave e o segredo da Lalamove no painel da Lalamove | É a única coisa que para o prejuízo em andamento. Remover os arquivos não resolve. | **você** (etapa 001) |
| 2 | Remover do repositório os 10 arquivos com a credencial (depois da rotação) | Enquanto estiverem versionados, todo clone novo distribui a chave | agente (etapa 002) |
| 3 | Rotacionar `service_role`, PAT do Supabase e senha do usuário de seed, e fechar o repositório | O histórico público tem essas três credenciais | **você** (etapa 003) |
| 4 | Fechar a regra que deixa qualquer login virar administrador | Enquanto isso existir, nenhuma outra proteção vale | agente (etapa 004), com sua aprovação |
| 5 | Fechar a lista de motoristas (nome e telefone) que hoje é legível sem login | Exposição de dado pessoal | agente (etapa 005), com sua aprovação |

## O que NÃO foi coberto

Três acessos faltaram nesta sessão, e isso limita o que pode ser afirmado sobre **produção**:

| Não coberto | Motivo exato |
|---|---|
| Estado real do banco de produção (schema, policies aplicadas, dados, índices em uso) | Nenhum MCP desta sessão aponta para o projeto oficial `iecgydonctmabiijadsf`; o token disponível só vê outro projeto (`Fuxico_V2`). Nenhuma consulta foi executada no banco. |
| Comportamento real das edge functions publicadas | O proxy desta sessão recusa `iecgydonctmabiijadsf.supabase.co` com `403 Forbidden (agent proxy: no rule or network setting allows this host)`. A única evidência de produção veio do log do CI. |
| Front em produção (render, console, celular real) | Mesmo bloqueio para `lalamove-v2.vercel.app`. |
| Estado do deploy e das variáveis na Vercel | O token disponível enxerga o time `juca1` mas devolve 0 projetos e 0 deployments. |
| Testes de ponta a ponta (Playwright) e testes Deno das edges | Playwright exige app servido com credenciais reais (não rodado para não tocar produção); Deno não está instalado nesta máquina. Evidência usada: os logs do CI. |

Por isso **todo achado que depende do estado real do banco está marcado `hipótese`** no `03-ACHADOS.md`,
com a frase do que falta para confirmar. Os demais são `confirmado` por leitura do código que roda.

Como consequência, dos 293 cenários da matriz, **50 foram EXECUTADOS** (comando/consulta/request rodado
nesta sessão) e **243 foram RASTREADOS** (caminho seguido no código). A distinção está linha por linha em
`02-CENARIOS.md` — nenhum cenário rastreado é apresentado como testado.

## Os arquivos

| Arquivo | Para quê |
|---|---|
| `docs/qa/00-RESUMO.md` | este |
| `docs/qa/01-INVENTARIO.md` | mapa do sistema e registro de cobertura (o que foi e o que não foi revisado, item por item) |
| `docs/qa/02-CENARIOS.md` | matriz de cenários por jornada, com EXECUTADO/RASTREADO |
| `docs/qa/03-ACHADOS.md` | os 282 achados, agrupados por causa raiz, com evidência e impacto |
| `docs/qa/04-PLANO.md` | instruções para o agente executor + as 300 etapas |
| `docs/qa/05-PROGRESSO.md` | checklist que o executor vai marcando |
