import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r'D:\opencode\workspace\senior_middle_school\2026年全国高考二卷数学卷真题及答案解析.pdf'
with open(pdf_path, 'rb') as f:
    response = requests.post(
        'http://localhost:8000/extract-mcq-enhanced',
        files={'file': (pdf_path.split('\\')[-1], f, 'application/pdf')},
        timeout=180
    )

data = response.json()
print('Status:', response.status_code)
print('Success:', data.get('success'))
print('MCQ count:', len(data.get('mcqs', [])))
print()
for i, mcq in enumerate(data.get('mcqs', [])[:3]):
    print(f'=== MCQ #{i+1} ===')
    print(f'question_number: {mcq.get("question_number")}')
    print(f'question: {repr(mcq.get("question", ""))}')
    print(f'question_type: {mcq.get("question_type")}')
    print(f'options: {repr(mcq.get("options"))}')
    print(f'correct_answer: {repr(mcq.get("correct_answer"))}')
    print()

doc = data.get('document_analysis', {})
print('has_mathematical_content:', doc.get('has_mathematical_content'))
extracted_text = doc.get('extracted_text', '')
print(f'extracted_text length: {len(extracted_text)}')
print(f'extracted_text preview: {repr(extracted_text[:300])}')
