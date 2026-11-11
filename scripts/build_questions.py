#!/usr/bin/env python3
"""Compila somente perguntas aprovadas em UTF-8 e impõe 10 pontos por acerto."""
import csv, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'questions'/'approved.csv'
metadata=json.loads((ROOT/'questions'/'metadata.json').read_text(encoding='utf-8'))
practice=json.loads((ROOT/'questions'/'r1.json').read_text(encoding='utf-8'))
rows=[]; ids=set(); prompts=set()
with source.open(newline='',encoding='utf-8-sig') as f:
 reader=csv.DictReader(f,delimiter=';')
 expected=['ID','Bloco','Tema','Pergunta']+[f'Resposta {i}' for i in range(1,9)]
 if reader.fieldnames!=expected: raise ValueError('Cabeçalho do CSV inválido')
 for line,row in enumerate(reader,2):
  if None in row: raise ValueError(f'Linha {line}: número incorreto de colunas')
  rid=row['ID'].strip(); block=row['Bloco'].strip(); title=row['Tema'].strip(); prompt=row['Pergunta'].strip()
  if not all((rid,block,title,prompt)): raise ValueError(f'Linha {line}: campos obrigatórios vazios')
  if rid in ids or prompt.casefold() in prompts:raise ValueError(f'Linha {line}: pergunta duplicada')
  ids.add(rid);prompts.add(prompt.casefold())
  answer_text=[row[f'Resposta {i}'].strip() for i in range(1,9)]
  if any(answer_text[i] and not answer_text[i-1] for i in range(1,8)): raise ValueError(f'Linha {line}: respostas devem ser consecutivas')
  answer_text=[a for a in answer_text if a]
  if not 3<=len(answer_text)<=8: raise ValueError(f'Linha {line}: esperadas 3 a 8 respostas')
  if len(set(x.casefold() for x in answer_text))!=len(answer_text): raise ValueError(f'Linha {line}: resposta duplicada')
  notes=metadata.get(rid, {})
  details=notes.get('details',[])
  if details and len(details)!=len(answer_text): raise ValueError(f'Linha {line}: detalhes divergentes')
  rows.append({'id':rid,'block':block,'title':title,'question':prompt,
    'answers':[{'label':text,'detail':details[i] if details else '', 'points':10} for i,text in enumerate(answer_text)],
    'notes':notes.get('notes','')})
seen=set()
for i,q in enumerate(practice):
 if q.get('id') in seen or q.get('id') in ids: raise ValueError(f'R1 #{i+1}: ID duplicado')
 seen.add(q['id'])
 if len(q.get('options',[]))!=4 or not isinstance(q.get('correct'),int) or not 0<=q['correct']<4:raise ValueError(f'R1 #{i+1}: alternativas/gabarito inválidos')
 if not q.get('prompt') or not q.get('explanation'):raise ValueError(f'R1 #{i+1}: pergunta ou explicação incompleta')
 q['points']=10
out=ROOT/'public'/'data.json'
out.write_text(json.dumps({'version':1,'pointsPerHit':10,'rounds':rows,'r1':practice},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(rows)} rodadas, {sum(len(r["answers"]) for r in rows)} respostas, {len(practice)} R1; pontos por acerto = 10')
