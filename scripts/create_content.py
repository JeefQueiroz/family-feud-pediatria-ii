#!/usr/bin/env python3
"""Seed original user-approved clinical questions, retaining longer points in notes."""
import csv, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rounds=[
('scv-anamnese','02','Anamnese cardiovascular','Quais informações não podem faltar ao investigar uma queixa cardiovascular em uma criança escolar?',[
('Palpitações e taquicardia','Início, duração, frequência, regularidade e início/término dos episódios.'),
('Cianose','Início, duração, localização central ou periférica, frequência e desencadeantes.'),
('Dor precordial','Localização, características, duração e relação com esforço físico.'),
('Síncope e pré-síncope','Circunstâncias, duração, sintomas associados e relação com exercício.'),
('Cansaço e esforço','Dispneia, fadiga, intolerância ao esforço e comparação com crianças da mesma idade.'),
('Antecedentes pessoais','Doenças prévias, internações, cirurgias e medicamentos em uso.'),
('Exames prévios','ECG, ecocardiograma e outros exames cardiovasculares, incluindo resultados.'),
('História gestacional e familiar','Intercorrências gestacionais/nascimento, cardiopatias, arritmias e morte súbita familiar.')],
'Sinal de alerta: síncope ao exercício, dor torácica de esforço, palpitação com síncope, cianose central, intolerância desproporcional, redução funcional, antecedentes relevantes ou morte súbita familiar. Palpitação é uma percepção subjetiva; taquicardia exige frequência cardíaca medida e interpretada conforme idade e contexto.'),
('sgi-anamnese','03','Anamnese gastrointestinal','Diante de dor abdominal em uma criança escolar, o que investigar na anamnese?',[
('Caracterização da dor','Início, duração, localização, irradiação, intensidade, frequência e evolução.'),
('Desencadeantes e alívio','Relação com alimentos, evacuação, esforço, sono e situações de estresse.'),
('Hábito intestinal','Frequência, consistência (Bristol), esforço e retenção de fezes.'),
('Alterações das fezes','Diarreia, muco, sangue, fezes enegrecidas e evacuações noturnas.'),
('Náuseas e vômitos','Frequência, conteúdo, bile ou sangue e relação com alimentação.'),
('Outros sintomas digestivos','Distensão, flatulência, pirose, regurgitação, disfagia e odinofagia.'),
('Alimentação e crescimento','Apetite, seletividade, dieta, água, perda de peso e curva de crescimento.'),
('Sintomas e antecedentes','Febre, sintomas urinários, manifestações extraintestinais, doenças, medicamentos e história familiar.')],
'Alertas: perda de peso/desaceleração do crescimento, febre inexplicada, dor persistente ou noturna, diarreia crônica/noturna, sangue nas fezes, vômitos persistentes/biliosos/com sangue, dor localizada persistente, disfagia/odinofagia ou exame anormal. Considerar constipação e transtornos funcionais, mas não presumir causa funcional sem história e exame.'),
('scv-exame','04','Exame físico cardiovascular','Quais etapas e elementos compõem o exame cardiovascular do escolar?',[
('Inspeção geral','Estado geral, cor da pele e mucosas, cianose, palidez, padrão respiratório e desconforto.'),
('Sinais vitais','Frequência cardíaca/respiratória, pressão arterial e saturação de O₂, interpretadas pela idade.'),
('Perfusão periférica','Temperatura das extremidades e tempo de enchimento capilar.'),
('Avaliação dos pulsos','Frequência, ritmo, amplitude, simetria e pulsos femorais.'),
('Inspeção do precórdio','Abaulamentos, retrações e impulsões visíveis.'),
('Palpação do precórdio','Ictus cordis, impulsões e pesquisa de frêmitos.'),
('Ausculta cardíaca','Frequência, ritmo, bulhas, sopros, cliques e outros ruídos.'),
('Caracterizar o sopro','Foco, fase, intensidade, duração, timbre, irradiação e variação com posição.')],
'Pulsos femorais diminuídos em relação aos superiores podem sugerir coarctação. Pressão arterial pediátrica depende de idade, sexo e estatura. Frêmito é vibração palpável associada ao fluxo turbulento. Interpretar toda a semiologia no contexto clínico.'),
('sopro-inocente','05','Sopro inocente','Quais características favorecem a hipótese de sopro inocente?',[
('Geralmente sistólico','Ocorre na sístole, não na diástole.'),
('Curta duração','Tipicamente curto.'),
('Baixa intensidade','Em geral até grau II/VI.'),
('Pouca irradiação','Mais localizado, com pouca ou nenhuma irradiação.'),
('Sem frêmito','Não costuma produzir frêmito palpável.'),
('Bulhas sem alterações','Sem cliques ou alterações patológicas das bulhas.'),
('Varia com posição','Pode mudar com posição corporal ou respiração.'),
('Criança assintomática','Sem sintomas ou achados indicativos de doença cardíaca.')],
'Um sopro não é classificado apenas pelo foco de ausculta. História, sintomas, pulsos e demais achados do exame importam.'),
('sopro-patologico','05','Sopro potencialmente patológico','Quais achados aumentam a suspeita de sopro patológico?',[
('Sopro diastólico','Sopros diastólicos exigem atenção.'),
('Sopro holossistólico','Ocorre ao longo de toda a sístole.'),
('Intensidade elevada','Particularmente grau III/VI ou superior.'),
('Timbre rude/áspero','Qualidade acústica sugestiva de possível anormalidade.'),
('Irradiação significativa','Especialmente para dorso ou região cervical.'),
('Presença de frêmito','Vibração palpável associada ao sopro.'),
('Ruídos anormais','Cliques, alteração de B2 ou outros ruídos patológicos.'),
('Sintomas associados','Síncope, cianose, intolerância ao esforço, pulsos anormais ou outras alterações.')],
'Sinais clínicos e alterações acústicas devem ser interpretados conjuntamente. Suspeita de sopro patológico pode exigir avaliação especializada e consideração de ecocardiograma.'),
('sgi-exame','06','Exame físico gastrointestinal','Quais etapas compõem o exame físico abdominal e o que avaliamos?',[
('Inspeção','Formato, simetria, distensão, cicatrizes, circulação colateral, pele, abaulamentos e movimentos.'),
('Ausculta','Ruídos hidroaéreos e sopros vasculares quando indicado.'),
('Percussão','Timpanismo/macicez, hepatimetria, Traube e investigação de ascite.'),
('Palpação superficial','Dor, hipersensibilidade, defesa e rigidez.'),
('Palpação profunda','Massas, vísceras e pontos dolorosos.'),
('Visceromegalias','Pesquisa de fígado, baço e rins.'),
('Manobras específicas','Irritação peritoneal, apendicite, colecistite, ascite e rim, conforme hipótese.')],
'Ordem: inspeção → ausculta → percussão → palpação. Acolher a criança, aquecer as mãos e começar longe da região dolorosa. Baço palpável em escolar exige correlação clínica e investigação quando indicado.')]
practice=[
{'id':'r1-01','title':'Pesquisa de irritação peritoneal','prompt':'Qual manobra pesquisa dor à descompressão brusca em criança com suspeita de irritação peritoneal?','options':['Sinal de Giordano','Manobra de Schuster','Sinal de Blumberg','Sinal de Murphy'],'correct':2,'explanation':'Sinal de Blumberg: dor mais intensa à descompressão do que à compressão sugere irritação peritoneal. Em crianças, evitar repetir manobras dolorosas; interpretar conforme contexto clínico.'},
{'id':'r1-02','title':'Hepatimetria','prompt':'Como avaliar o tamanho do fígado por percussão?','options':['Percutir exclusivamente hipocôndrio esquerdo','Delimitar limites superior e inferior da macicez e medir a distância','Fazer apenas palpação profunda do hipocôndrio direito','Percutir região umbilical até achar macicez'],'correct':1,'explanation':'Usualmente na linha hemiclavicular direita: marcar limite superior onde som pulmonar vira macicez, inferior onde som abdominal vira macicez; medir distância. Referências devem ser pediátricas.'},
{'id':'r1-03','title':'Pesquisa do baço','prompt':'Qual técnica pode facilitar a palpação de um baço discretamente aumentado?','options':['Manobra de Schuster em decúbito lateral direito','Decúbito ventral e palpação no hipocôndrio direito','Percussão da fossa ilíaca direita sem palpação','Palpação superficial epigástrica na expiração'],'correct':0,'explanation':'Manobra de Schuster: decúbito lateral direito, com posicionamento apropriado dos membros; palpação em direção ao rebordo costal esquerdo durante inspiração. Não determinar causa apenas pela palpação.'},
{'id':'r1-04','title':'Pesquisa de ascite','prompt':'Qual manobra pode investigar líquido livre na cavidade peritoneal?','options':['Sinal de Rovsing','Sinal de Murphy','Sinal do psoas','Pesquisa de macicez móvel'],'correct':3,'explanation':'A mudança da região de macicez com a alteração do decúbito sugere líquido livre (ascite), devendo ser interpretada com outros achados.'},
{'id':'r1-05','title':'Avaliação do trato urinário','prompt':'Qual manobra pesquisa dor à punho-percussão no ângulo costovertebral?','options':['Sinal de Blumberg','Sinal de Giordano','Manobra de Schuster','Sinal de Murphy'],'correct':1,'explanation':'Sinal de Giordano: percussão suave no ângulo costovertebral. Dor pode apoiar suspeita de acometimento renal, mas não confirma pielonefrite isoladamente.'}
]
with (ROOT/'questions'/'approved.csv').open('w',encoding='utf-8',newline='') as f:
 w=csv.writer(f,delimiter=';');w.writerow(['ID','Bloco','Tema','Pergunta']+[f'Resposta {i}' for i in range(1,9)])
 for rid,block,title,prompt,answers,note in rounds:w.writerow([rid,block,title,prompt]+[a[0] for a in answers]+['']*(8-len(answers)))
metadata={r[0]:{'notes':r[5],'details':[a[1] for a in r[4]]} for r in rounds}
(ROOT/'questions'/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'questions'/'r1.json').write_text(json.dumps(practice,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Geradas',len(rounds),'rodadas,',sum(len(r[4]) for r in rounds),'respostas,',len(practice),'questões R1')
