# -*- coding: utf-8 -*-
import requests
import json
import sys

pdf_path = r'D:\opencode\workspace\senior_middle_school\2026年全国高考二卷数学卷真题及答案解析.pdf'
url = 'http://localhost:8000/render-all-pages'

with open(pdf_path, 'rb') as f:
    files = {'file': ('test.pdf', f, 'application/pdf')}
    data = {'dpi': '100'}
    try:
        resp = requests.post(url, files=files, data=data, timeout=180)
        result = resp.json()
        if result.get('success'):
            pages = result.get('pages', [])
            print('SUCCESS: {} pages rendered'.format(len(pages)))
            for p in pages[:3]:
                print('  Page {}: {}x{}px, b64len={}'.format(p['page_num'], p['width'], p['height'], len(p['image_base64'])))
            if len(pages) > 3:
                print('  ... and {} more pages'.format(len(pages) - 3))
        else:
            print('FAILED: ' + str(result))
            sys.exit(1)
    except Exception as e:
        print('ERROR: ' + str(e))
        sys.exit(1)
