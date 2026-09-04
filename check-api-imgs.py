import requests
import json

pdf_path = r'D:\opencode\workspace\senior_middle_school\2026年全国高考二卷数学卷真题及答案解析.pdf'
url = 'http://127.0.0.1:8080/file_parse'

with open(pdf_path, 'rb') as f:
    files = {'files': ('test.pdf', f, 'application/pdf')}
    data = {
        'backend': 'pipeline',
        'lang_list': 'ch',
        'formula_enable': 'true',
        'return_md': 'true',
        'return_images': 'true',
        'start_page_id': '14',
        'end_page_id': '15',
    }
    print('Calling MinerU API...')
    resp = requests.post(url, files=files, data=data, timeout=300)
    print('Status:', resp.status_code)
    result = resp.json()
    print('Task status:', result.get('status'))
    
    results = result.get('results', {})
    for key, val in results.items():
        print('\nResult keys:', list(val.keys()))
        
        # Check images
        if 'images' in val:
            imgs = val['images']
            if isinstance(imgs, dict):
                print('Images (dict):', len(imgs), 'keys')
                for ik in list(imgs.keys())[:2]:
                    iv = imgs[ik]
                    if isinstance(iv, str):
                        print(f'  {ik}: base64 string, len={len(iv)}')
                    elif isinstance(iv, dict):
                        print(f'  {ik}: object keys={list(iv.keys())}')
            elif isinstance(imgs, list):
                print('Images (list):', len(imgs))
                if imgs:
                    print('  First type:', type(imgs[0]).__name__)
        
        # Check md for image refs
        md = val.get('md_content', '')
        import re
        refs = re.findall(r'!\[.*?\]\([^)]+\)', md)
        print(f'\nImage refs in markdown: {len(refs)}')
        for r in refs[:5]:
            print(f'  {r}')
        
        # Save markdown for inspection
        with open('mineru-md-sample.txt', 'w', encoding='utf-8') as mf:
            mf.write(md)
        print(f'\nMarkdown saved to mineru-md-sample.txt ({len(md)} chars)')
        break
