import requests, json, os, sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Login as admin
r = requests.post('http://localhost:3000/api/auth/login', json={'studentId':'admin1','password':'admin123'}, timeout=10)
token = r.json()['token']
print(f"Admin login: {r.status_code}")

# Delete old test papers #15, #16 if exist (cleanup)
for pid in [15, 16]:
    try:
        del_r = requests.delete(f'http://localhost:3000/api/papers/{pid}', headers={'Authorization': f'Bearer {token}'}, timeout=10)
        print(f"Delete old paper #{pid}: {del_r.status_code}")
    except Exception as e:
        print(f"Delete old paper #{pid} (skipped): {e}")

# Import PDF
pdf_path = r'D:\opencode\workspace\senior_middle_school\2026年全国高考二卷数学卷真题及答案解析.pdf'
print(f"\n--- Importing PDF ---")
files = {'file': open(pdf_path, 'rb')}
r2 = requests.post('http://localhost:3000/api/papers/import', headers={'Authorization': f'Bearer {token}'}, files=files, timeout=180)
import_data = r2.json()
paper_id = import_data.get('paper', {}).get('id')
print(f"Import status: {r2.status_code}")
print(f"Paper ID: {paper_id}")
print(f"sourceFormat: {import_data.get('paper', {}).get('sourceFormat')}")
print(f"hasMathContent: {import_data.get('hasMathContent')}")
print(f"extractionFallback: {import_data.get('extractionFallback')}")
print(f"contentLength: {import_data.get('contentLength')}")

# Split questions
print(f"\n--- Splitting questions for paper #{paper_id} ---")
r3 = requests.post(f'http://localhost:3000/api/papers/{paper_id}/split', headers={'Authorization': f'Bearer {token}'}, timeout=60)
split_data = r3.json()
print(f"Split status: {r3.status_code}")
print(f"Questions created: {split_data.get('questionsCreated')}")

# Save full result
with open('import-test-result.json', 'w', encoding='utf-8') as f:
    json.dump({'import': import_data, 'split': split_data}, f, ensure_ascii=False, indent=2)

# Show question summary (ASCII-safe)
qs = split_data.get('questions', [])
print(f"\n--- {len(qs)} Questions Summary ---")
for q in qs:
    qnum = q.get('questionNumber')
    qtype = q.get('questionType', 'unknown')
    content = q.get('content', '')
    # Replace non-ASCII with ? for console display
    safe_preview = content[:60].encode('ascii', 'replace').decode('ascii')
    print(f"Q{qnum} [{qtype}] ({len(content)} chars): {safe_preview}...")

# Verify questions in DB
print(f"\n--- Verifying questions in DB ---")
r4 = requests.get(f'http://localhost:3000/api/papers/{paper_id}/questions', headers={'Authorization': f'Bearer {token}'}, timeout=10)
print(f"GET /papers/{paper_id}/questions: {r4.status_code}")
db_qs = r4.json()
qcount = len(db_qs) if isinstance(db_qs, list) else (len(db_qs.get('data', [])) if isinstance(db_qs, dict) else 'unknown')
print(f"Questions in DB: {qcount}")
