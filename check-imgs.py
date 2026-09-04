import json
with open('mineru-images-test.json', 'r', encoding='utf-8') as f:
    raw = f.read()
# Find JSON start
idx = raw.index('{')
data = json.loads(raw[idx:])
results = data.get('results', {})
for key, val in results.items():
    print('Result keys:', list(val.keys()))
    if 'images' in val:
        imgs = val['images']
        if isinstance(imgs, dict):
            img_keys = list(imgs.keys())
            print('Images count:', len(img_keys))
            for ik in img_keys[:2]:
                iv = imgs[ik]
                if isinstance(iv, str):
                    print(f'  {ik}: base64 string, len={len(iv)}')
                elif isinstance(iv, dict):
                    print(f'  {ik}: object, keys={list(iv.keys())}')
                    for subk in iv:
                        subv = iv[subk]
                        if isinstance(subv, str):
                            print(f'    {subk}: len={len(subv)}, preview={subv[:60]}')
        elif isinstance(imgs, list):
            print('Images count:', len(imgs))
            if imgs:
                print('  First image type:', type(imgs[0]).__name__)
                if isinstance(imgs[0], dict):
                    print('  First image keys:', list(imgs[0].keys()))
    md = val.get('md_content', '')
    import re
    refs = re.findall(r'!\[.*?\]\([^)]+\)', md)
    print(f'\nImage refs in markdown: {len(refs)}')
    for r in refs[:3]:
        print(f'  {r}')
    break
