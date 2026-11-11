import csv,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class ContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'public'/'data.json').read_text(encoding='utf8'))

    def test_all_questions_from_approved_csv_only(self):
        with (ROOT/'questions'/'approved.csv').open(newline='',encoding='utf8') as f:
            source=list(csv.DictReader(f,delimiter=';'))
        self.assertEqual(len(self.data['rounds']),len(source))
        self.assertEqual([r['question'] for r in self.data['rounds']],[r['Pergunta'] for r in source])

    def test_round_counts(self):
        self.assertEqual(len(self.data['rounds']),6)
        self.assertEqual(sum(len(r['answers']) for r in self.data['rounds']),47)
        self.assertEqual(sum(len(r['answers']) for r in self.data['rounds'][:5]),40)
        self.assertEqual(len(self.data['rounds'][5]['answers']),7)

    def test_score_is_ten_per_hit(self):
        self.assertEqual(self.data['pointsPerHit'],10)
        for r in self.data['rounds']:
            self.assertTrue(3<=len(r['answers'])<=8)
            self.assertTrue(all(a['points']==10 for a in r['answers']))
        self.assertTrue(all(q['points']==10 for q in self.data['r1']))
        self.assertEqual(sum(a['points'] for r in self.data['rounds'] for a in r['answers']),470)

    def test_r1_correct_answers(self):
        self.assertEqual(len(self.data['r1']),5)
        self.assertEqual([q['correct'] for q in self.data['r1']],[2,1,0,3,1])
        self.assertTrue(all(len(q['options'])==4 for q in self.data['r1']))

    def test_no_legacy_english_data(self):
        blob=(ROOT/'public'/'data.json').read_text(encoding='utf8').lower()
        for phrase in ['name something people','original csv','milk / creamer']:
            self.assertNotIn(phrase,blob)

if __name__=='__main__':unittest.main()
