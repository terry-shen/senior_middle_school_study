import requests, json

r = requests.post('http://localhost:3000/api/auth/login', json={'studentId':'admin1','password':'admin123'}, timeout=10)
token = r.json()['token']

r2 = requests.post('http://localhost:3000/api/papers/15/split', headers={'Authorization': f'Bearer {token}'}, timeout=60)
data = r2.json()

with open('split-result.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Split status: {r2.status_code}")
print(f"Questions created: {data.get('questionsCreated')}")
qs = data.get('questions', [])
print(f"Question count: {len(qs)}")
for q in qs[:12]:
    qnum = q.get('questionNumber')
    qtype = q.get('questionType')
    content = q.get('content', '')
    options = q.get('options', [])
    opt_count = len(options) if options else 0
    print(f"Q{qnum}: type={qtype} content_len={len(content)} options={opt_count}")
    print(f"  content preview: {content[:80]}")
