# Family Feud — Pediatria II

Aplicativo de monitoria com conteúdo autorizado do roteiro fornecido: **somente seis rodadas (47 respostas) e cinco questões práticas (Quem quer ser um R1?)**. Os CSVs antigos e todas as perguntas preexistentes em inglês foram excluídos desta distribuição.

## Regras

- Respostas de Family Feud: **10 pontos por acerto**. Multiplicadores opcionais 1×, 2× ou 3×.
- R1: **10 pontos por acerto**, sem multiplicador.
- A pontuação de cada rodada pode ser concedida uma vez para uma equipe e desfeita.
- Cada rodada contém até oito respostas. O painel exibe oito posições.

As respostas dos painéis são categorias didáticas, não resultados de pesquisa com público. O apresentador decide quando uma resposta dada se enquadra em uma categoria.

## Executar

```bash
python3 -m http.server 4173 -d public
```

Abra `http://localhost:4173/` (tela de projeção) e `http://localhost:4173/admin/` (controle) **em abas do mesmo navegador**. Atalhos no admin: teclas 1–8 revelam as respostas, `X` registra erro, setas alternam questões.

> Atenção: o sincronismo usa BroadcastChannel e localStorage do navegador, e **não funciona entre máquinas diferentes**. O controle administrativo não tem autenticação; não deve ser exposto publicamente sem proteção.

## Alterar perguntas aprovadas

Modifique apenas `questions/approved.csv` para as rodadas; `questions/metadata.json` contém detalhes e notas; `questions/r1.json` contém as cinco questões práticas.

```bash
python3 scripts/build_questions.py
python3 -m unittest discover -s tests -v
```

O compilador gera `public/data.json` **apenas a partir** do CSV aprovado e do JSON do R1. O arquivo original de 3.919 perguntas não existe neste pacote.

## Publicação (GitHub JeefQueiroz + Vercel Euvouserdoutor)

O conector do GitHub disponível nesta conversa não possui operação de criação de repositórios. O conector Vercel retornou **403 forbidden** na criação do projeto na equipe `euvouserdoutorrs-projects`. **A publicação não foi realizada automaticamente.**

Para publicar no Mac autenticado nas duas contas, execute na pasta extraída:

```bash
bash deploy-mac.sh
```

O script valida os dados, cria um **novo repositório privado** `JeefQueiroz/family-feud-pediatria-ii`, envia os arquivos, cria/vincula o projeto Vercel na equipe `euvouserdoutorrs-projects`, conecta a integração GitHub e publica a produção. Ele interrompe se detectar conta errada, repositório remoto divergente ou falta de permissão; não modifica sites existentes.

Requisitos: `git`, `gh` autenticado em `JeefQueiroz`, `python3` e Vercel CLI ou `npx` autenticado em `Euvouserdoutor`. Caso a Vercel continue retornando `403`, o titular da equipe precisa liberar a permissão de criar projetos. Não é possível completar uma publicação sem essa autorização.

**Atenção:** a página `/admin/` não tem autenticação e o `BroadcastChannel` sincroniza somente abas/dispositivos no mesmo navegador/perfil e origem, não dois computadores independentes. Um link público da TV não significa controle remoto do painel administrativo. Evite usar informações sensíveis no aplicativo estático.

## Testes

`python3 -m unittest discover -s tests -v` valida conteúdo e pontuações. `python3 tests/browser_check.py` executa teste offline do painel no Chromium/Playwright (exige dependências de teste locais). O teste offline não prova sincronia em rede nem funcionamento de deploy.

## Origem

Os textos clínicos e gabaritos foram adaptados do roteiro de monitoria fornecido pelo usuário, preservado em `docs/roteiro-original.txt`. A interface é uma implementação web independente, não inclui código, marcas gráficas ou materiais licenciados do programa televisivo.

## Conferência da inclusão após publicação

O script de deploy agora valida **o conteúdo realmente servido pela Vercel**, comparando `/data.json` ao arquivo aprovado local, e confere `/`, `/admin/`, JavaScript e CSS. Em qualquer divergência, interrompe com erro, sem declarar sucesso. A verificação também pode ser executada manualmente:

```bash
python3 scripts/verify_publication.py https://URL-DO-SEU-DEPLOY.vercel.app
```

A checagem confirma arquivos acessíveis naquele endereço, mas não substitui o teste de sincronismo de múltiplos dispositivos ou a proteção de acesso ao painel administrativo.
