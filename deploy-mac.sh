#!/usr/bin/env bash
# Publica apenas o Family Feud — Pediatria II, sem tocar em outros projetos.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
GH_OWNER="JeefQueiroz"
PROJECT="family-feud-pediatria-ii"
REPO="$GH_OWNER/$PROJECT"
VERCEL_SCOPE="euvouserdoutorrs-projects"

fail() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
for bin in git gh python3; do command -v "$bin" >/dev/null || fail "Comando '$bin' indisponível. Instale-o antes de prosseguir."; done

printf '\n[1/7] Validando conteúdo e aplicação...\n'
python3 scripts/build_questions.py
python3 -m unittest discover -s tests -v

printf '\n[2/7] Selecionando GitHub %s...\n' "$GH_OWNER"
gh auth switch --hostname github.com --user "$GH_OWNER" || fail "Entre na conta $GH_OWNER com 'gh auth login' e execute de novo."
CURRENT_GH="$(gh api user --jq .login)"
[[ "$CURRENT_GH" == "$GH_OWNER" ]] || fail "Conta GitHub incorreta: $CURRENT_GH"

printf '\n[3/7] Preparando repositório local...\n'
if [[ ! -d .git ]]; then git init -b main; fi
[[ "$(git branch --show-current)" == "main" ]] || fail "Branch local não é main. Não alterei branches automaticamente."
if ! git config user.name >/dev/null; then git config user.name "$GH_OWNER"; fi
if ! git config user.email >/dev/null; then git config user.email "$GH_OWNER@users.noreply.github.com"; fi
git add -A
if ! git diff --cached --quiet; then git commit -m "feat: publicar Family Feud Pediatria II — perguntas aprovadas"; fi

printf '\n[4/7] Publicando no GitHub...\n'
if gh repo view "$REPO" >/dev/null 2>&1; then
  REMOTE="$(git remote get-url origin 2>/dev/null || true)"
  case "$REMOTE" in
    "https://github.com/$REPO"|"https://github.com/$REPO.git"|"git@github.com:$REPO.git") ;;
    *) fail "O repositório $REPO já existe, mas origin não corresponde. Evitando sobrescrever conteúdo remoto." ;;
  esac
  git fetch origin main
  git merge-base --is-ancestor origin/main HEAD || fail "A branch remota tem commits não presentes localmente; revise antes de fazer push."
  git push origin main
else
  gh repo create "$REPO" --private --source=. --remote=origin --push \
    --description "Dinâmica interativa de Semiologia — Pediatria II (monitoria)"
fi

echo "GitHub: https://github.com/$REPO"

printf '\n[5/7] Conferindo autenticação Vercel e equipe...\n'
if command -v vercel >/dev/null 2>&1; then
  VERCEL=(vercel)
elif command -v npx >/dev/null 2>&1; then
  VERCEL=(npx --yes vercel@latest)
else
  fail "Instale Node.js e a Vercel CLI e execute novamente. GitHub já está publicado."
fi
"${VERCEL[@]}" whoami >/dev/null || fail "Faça 'vercel login' na conta Euvouserdoutor e tente novamente."
"${VERCEL[@]}" project ls --scope "$VERCEL_SCOPE" >/dev/null || fail "Sua conta Vercel não tem acesso à equipe $VERCEL_SCOPE. GitHub já foi publicado."
if ! "${VERCEL[@]}" project inspect "$PROJECT" --scope "$VERCEL_SCOPE" >/dev/null 2>&1; then
  "${VERCEL[@]}" project add "$PROJECT" --scope "$VERCEL_SCOPE"
fi
"${VERCEL[@]}" link --yes --project "$PROJECT" --scope "$VERCEL_SCOPE"
"${VERCEL[@]}" git connect --yes --scope "$VERCEL_SCOPE" || fail "Repositório enviado, mas não foi possível conectar integração Git à Vercel."

printf '\n[6/7] Publicando produção na Vercel...\n'
DEPLOY_OUTPUT="$("${VERCEL[@]}" deploy --prod --yes --scope "$VERCEL_SCOPE")"
printf '%s\n' "$DEPLOY_OUTPUT"
DEPLOY_URL="$(printf '%s\n' "$DEPLOY_OUTPUT" | grep -Eo 'https://[^[:space:]]+' | tail -n 1 || true)"
[[ -n "$DEPLOY_URL" ]] || fail "Deploy enviado, mas não foi possível identificar a URL para validação. Confira no painel Vercel."
printf '\n[7/7] Conferindo inclusão de todas as perguntas no site publicado...\n'
python3 scripts/verify_publication.py "$DEPLOY_URL" || fail "A URL publicada não passou na verificação de conteúdo e páginas. Revise o deploy."
printf '\nPublicado e verificado: %s\n' "$DEPLOY_URL"
