# Family Feud — Pediatria II

Jogo de monitoria de semiologia pediátrica. Usa apenas as **7 rodadas aprovadas (55 respostas)** e **5 desafios R1**, sem perguntas preexistentes em inglês.

## Funcionamento

- Cada resposta inédita revelada pelo apresentador soma **10 pontos automaticamente à equipe selecionada**. Não há multiplicador de pontuação.
- Respostas reveladas ficam salvas por rodada para impedir pontuação duplicada ao navegar e voltar.
- Acerto: revela o cartão e zera os erros. Erro: registra ✕ e alterna o time. Até 3 erros antes do próximo acerto.
- Cronômetro de **10 segundos**, com iniciar, pausar, retomar, reiniciar e encerramento ao chegar a zero.
- Desafio R1: mostra quatro alternativas e dá 10 pontos manualmente após revelar o gabarito. Cada R1 só pode ser premiado uma vez.
- Na TV, o time ativo aparece destacado, com contador e efeitos sonoros; um primeiro clique ou toque pode ser necessário para permitir áudio, conforme navegador.
- **Desfazer último acerto** funciona dentro da rodada atual. **Reiniciar partida** limpa placares e respostas e exige confirmação.

## Acessos

TV/projetor: https://family-feud26.vercel.app/

Painel do apresentador (iPhone/computador): https://family-feud26.vercel.app/admin/

O painel é protegido por **PIN de 6 dígitos**, validado por uma Supabase Edge Function. Não é preciso cadastrar e-mail/senha. O PIN nunca deve ser incorporado ao código do navegador.

O Supabase Realtime transmite alterações de estado entre dispositivos diferentes. A TV tem somente leitura; gravações passam pela Edge Function e suas verificações. A conexão precisa estar disponível. O painel exibe o estado da sincronização, inclusive erros de salvamento.

O jogo é didático, não um serviço clínico. Evite dados pessoais de pacientes.

## Dados

- `questions/approved.csv`: perguntas e respostas aprovadas
- `questions/metadata.json`: detalhes das respostas e notas
- `questions/r1.json`: questões R1
- `scripts/build_questions.py`: valida e compila os arquivos para `public/data.json`

As categorias são respostas didáticas definidas no roteiro, não resultados de pesquisa com uma população.

## Testes e build

```bash
python3 scripts/build_questions.py
python3 -m unittest discover -s tests -v
node --check public/assets/app.js
node --check public/assets/remote-sync.js
python3 -m pip install playwright
python3 -m playwright install chromium
python3 tests/browser_check.py
```

O GitHub Actions executa essas verificações automaticamente. O teste de navegador usa transporte remoto simulado: confirma interface, cronômetro, navegação, placares e TV, mas **não substitui um teste real de sincronização entre iPhone e projetor nem de disponibilidade do Supabase**.

## Publicação

Repositório: `JeefQueiroz/family-feud-pediatria-ii`

Vercel: equipe `euvouserdoutorrs-projects`, projeto `family-feud-pediatria-ii`; publicação via branch `main`.

A branch `feature/supabase-remote-control` é para testes. Deployments de Preview podem exigir autenticação Vercel, dependendo das configurações da equipe; isso não significa falha do aplicativo.

## Conteúdo

O roteiro-fonte foi preservado em `docs/roteiro-original.txt`. Os textos de semiologia foram adaptados para dinâmica didática. A interface não incorpora conteúdo protegido ou a marca gráfica do programa de televisão.
