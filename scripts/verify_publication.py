#!/usr/bin/env python3
"""Confere se a publicação contém exatamente o banco aprovado e as duas interfaces."""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def get_content(base, path):
    req = urllib.request.Request(base + path, headers={"User-Agent": "FamilyFeud-PediatriaII-release-check/1.0"})
    with urllib.request.urlopen(req, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"{path}: HTTP {response.status}")
        return response.read()


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python3 scripts/verify_publication.py https://URL-VERCEL")
    url = sys.argv[1].strip().rstrip('/')
    parts = urlsplit(url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path not in ('', '/'):
        raise SystemExit("Informe somente a origem HTTPS do site, sem caminho ou parâmetros")
    expected = json.loads((ROOT / 'public' / 'data.json').read_text(encoding='utf-8'))
    try:
        actual = json.loads(get_content(url, '/data.json').decode('utf-8'))
        if actual != expected:
            raise RuntimeError("O JSON remoto não corresponde ao banco de perguntas aprovado no pacote")
        assert len(actual['rounds']) == 6, 'Quantidades de rodadas incorretas'
        assert sum(len(q['answers']) for q in actual['rounds']) == 47, 'Quantidade de respostas incorreta'
        assert len(actual['r1']) == 5, 'Quantidade de desafios R1 incorreta'
        assert actual['pointsPerHit'] == 10, 'Pontuação geral incorreta'
        assert all(a['points'] == 10 for q in actual['rounds'] for a in q['answers']), 'Resposta sem 10 pontos'
        assert all(q['points'] == 10 for q in actual['r1']), 'R1 sem 10 pontos'
        for path in ('/', '/admin/'):
            page = get_content(url, path).decode('utf-8', errors='replace')
            if '<html' not in page.lower() or 'pediatria ii' not in page.lower():
                raise RuntimeError(f"{path}: página incorreta ou sem identidade Pediatria II")
        js = get_content(url, '/assets/app.js')
        css = get_content(url, '/assets/styles.css')
        if not js or not css:
            raise RuntimeError('Recursos visuais não disponíveis')
    except (urllib.error.URLError, ValueError, KeyError, AssertionError, RuntimeError) as exc:
        raise SystemExit(f"FALHA na verificação da publicação: {exc}")
    print('PUBLICAÇÃO CONFERIDA: 6 rodadas / 47 respostas / 5 R1 / 10 pontos; TV, admin e assets acessíveis.')
    print('OBS: este teste não confirma proteção do admin nem sincronismo entre dispositivos.')


if __name__ == '__main__':
    main()
