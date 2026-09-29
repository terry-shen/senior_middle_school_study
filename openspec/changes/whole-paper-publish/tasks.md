## 1. 閺佺増宓佹惔鎾圭讣缁?
- [x] 1.1 schema.prisma ExamPaper 濡€崇€烽弬鏉款杻 `purpose String @default("question_source")` 鐎涙顔岄敍灞惧⒔鐞?`npx prisma db push`閿涘矂鐛欑拠浣哄箛閺堝鏆熼幑?purpose 姒涙顓绘稉?question_source
- [x] 1.2 妤犲矁鐦?prisma generate 閹存劕濮涢敍宀€骞囬張?ExamPaper 閺屻儴顕?閸掓稑缂撴稉宥呭綀瑜板崬鎼烽敍鍧rpose 鐎涙顔岄張澶愮帛鐠併倕鈧》绱?

## 2. 閸氬海顏弫鏉戝祹鐎电厧鍙?API

- [x] 2.1 papers.ts 閺傛澘顤?`POST /api/papers/import-whole` 缁旑垳鍋ｉ敍鍧甧quireAuth, requireAdmin, multer upload.single('file')閿涘绱伴幒銉︽暪閺傚洣娆?+ 閸忓啯鏆熼幑顕嗙礄title 韫囧懎锝? year/region/examType/totalScore/duration 閸欘垶鈧绱氶敍灞肩箽鐎涙ɑ鏋冩禒璺哄煂 uploads/papers/閿涘苯鍨卞?ExamPaper閿涘潷urpose='whole_paper', pdfUrl=閺傚洣娆㈢捄顖氱窞, status='uploaded'閿涘绱濇稉宥堢殶閻?MinerU/閹峰棗鍨庨柅鏄忕帆閿涘矁绻戦崶?{success, paper} 閳?妤犲矁鐦?tsc 缂傛牞鐦ч柅姘崇箖
- [x] 2.2 閺傚洣娆㈤崥?mojibake 娣囶喖顦查敍姝欱uffer.from(req.file.originalname, 'latin1').toString('utf8')` 閻劋绨?title 姒涙顓婚崐纭风礄瑜?title 閺堫亜锝為弮鍓佹暏閺傚洣娆㈤崥宥忕礆
- [x] 2.3 妤犲矁鐦夐弫鏉戝祹鐎电厧鍙嗙粩顖滃仯娑撳秴鍨卞?Question閵嗕椒绗夐崘?parsedMarkdown/editedMarkdown閿涘潏url 濞村鐦?POST 閸氬孩鐓?DB 绾喛顓婚敍?
## 3. 閸氬海顏弫鏉戝祹閺傚洣娆㈡稉瀣祰 API

- [x] 3.1 papers.ts 閺傛澘顤?`GET /api/papers/:id/download-file` 缁旑垳鍋ｉ敍鍧甧quireAuth閿涘绱伴弻?ExamPaper.pdfUrl閿涘矁绻戦崶?res.download(閺傚洣娆㈢捄顖氱窞)閿涘本鏋冩禒鏈电瑝鐎涙ê婀潻鏂挎礀 404 閳?妤犲矁鐦?tsc 缂傛牞鐦ч柅姘崇箖
- [x] 3.2 閺夊啴妾洪弽锟犵崣閿涙艾顒熼悽鐔峰涧閼虫垝绗呮潪钘夊嚒閸欐垵绔烽敍鍫濈摠閸?Exam.status=published 娑?ExamAssignment.studentId=鐠囥儱顒熼悽鐕傜礆閻ㄥ嫭鏆ｉ崡鍑ょ礉閺堫亜褰傜敮鍐╁灗閺堫亜鍨庨柊宥堢箲閸?403 閳?妤犲矁鐦夐棃鐐插瀻闁板秴顒熼悽鐔活問闂傤喛绻戦崶?403

## 4. 閸氬海顏拠鏇炲祹閸掓銆冮崠鍝勫瀻閻劑鈧?
- [x] 4.1 papers.ts GET / 閸掓銆冮弻銉嚄 include purpose 鐎涙顔岄敍鍫濆嚒閺?include _count閿涘苯濮?purpose 閸楀啿褰查敍灞炬￥闂団偓妫版繂顦婚弻銉嚄閿涘鈧?妤犲矁鐦夋潻鏂挎礀閺佺増宓侀崥?purpose 鐎涙顔?
- [x] 4.2 GET / 閺€顖涘瘮閹?purpose 缁涙盯鈧绱檘uery param `purpose=whole_paper` 閹?`purpose=question_source`閿涘绱濇笟澶哥艾閸撳秶顏幐澶愭付鏉╁洦鎶?閳?妤犲矁鐦?curl ?purpose=whole_paper 閸欘亣绻戦崶鐐存殻閸?
## 5. 閸氬海顏弫鏉戝祹閸欐垵绔?

- [x] 5.1 online-exams.ts 绾喛顓?POST / :id/publish 鐎?questionIds=[] 閻?Exam 娑撳秴浠涢幏锔藉焻閿涘牐瀚㈤弮鐘冲閹搭亜鍨弮鐘绘付閺€鐟板З閿涘鈧?妤犲矁鐦夐弫鏉戝祹 Exam 閸欘垱顒滅敮绋垮絺鐢?- [x] 5.2 婵?publish 鐠侯垳鏁遍張?questionIds 闂堢偟鈹栭弽锟犵崣閿涘奔鎱ㄩ弨閫涜礋閸忎浇顔忕粚鐑樻殶缂?閳?妤犲矁鐦夐崣鎴濈閺佹潙宓?Exam 鏉╂柨娲?200

## 6. 閸撳秶顏弫鏉戝祹鐎电厧鍙嗘い鐢告桨

- [x] 6.1 閺傛澘顤?WholePaperImport.tsx 妞ょ敻娼伴敍姘瀮娴犳湹绗傛导鐘插隘閿涘潊ccept .pdf,.doc,.docx閿? 閸忓啯鏆熼幑顔裤€冮崡鏇礄title 韫囧懎锝? year/region/examType/totalScore/duration 閸欘垶鈧绱? 閹绘劒姘﹂幐澶愭尦鐠嬪啰鏁?POST /api/papers/import-whole 閳?妤犲矁鐦夋い鐢告桨濞撳弶鐓嬮弮鐘冲Г闁?- [x] 6.2 閺傛澘顤?WholePaperImport.css 閺嶅嘲绱￠敍鍫濐槻閻?PaperImport.css 妞嬪孩鐗搁敍?- [x] 6.3 papers-api.ts 閺傛澘顤?importWholePaper(token, file, metadata) 閸戣姤鏆熼敍鍦榦rmData 娑撳﹣绱堕敍澶嗏偓?妤犲矁鐦?tsc 缂傛牞鐦ч柅姘崇箖
- [x] 6.4 App.tsx 閺傛澘顤冪捄顖滄暠 /papers/import-whole閿涘湧rotectedRoute requireAdmin閿? 閹虫帒濮炴潪?import 閳?妤犲矁鐦夌捄顖滄暠閸欘垵顔栭梻?
## 7. 閸撳秶顏拠鏇炲祹閸掓銆冮崠鍝勫瀻閺佹潙宓?閹峰棗鍨?

- [x] 7.1 PaperImport.tsx 妞ゅ爼鍎撮弰鍓с仛娑撱倓閲滈崗銉ュ經閹稿鎸抽敍姘モ偓灞炬殻閸楀嘲顕遍崗銉ｂ偓?鐠哄疇娴?/papers/import-whole) + 閵嗗本濯堕崚鍡楊嚤閸忋儯鈧?鐠哄疇娴?/papers/import) 閳?妤犲矁鐦夋稉銈勯嚋閹稿鎸抽崣顖滃仯閸戞槒鐑︽潪?- [x] 7.2 PaperImport.tsx 鐠囨洖宓庨崚妤勩€冪悰銊︾壐閺傛澘顤?閻劑鈧?閸掓绱皃urpose=whole_paper 閺勫墽銇?閺佹潙宓?閿涘urpose=question_source 閺勫墽銇?閹峰棗鍨庨弶銉︾爱" 閳?妤犲矁鐦夐崚妤侇劀绾喗妯夌粈?- [x] 7.3 PaperImport.tsx 閹垮秳缍旈幐澶愭尦閹?purpose 閸掑棙绁﹂敍姝竓ole_paper 鐞涘本妯夌粈鎭掆偓灞藉絺鐢啨鈧?鐠哄疇娴嗛崣鎴濈濞翠胶鈻? +閵嗗奔绗呮潪鑺ユ瀮娴犺翰鈧?GET /download-file) +閵嗗苯鍨归梽銈冣偓宥忕幢question_source 鐞涘本妯夌粈铏瑰箛閺堝鈧瞼绱潏鎴炵墡閸?妫板嫯顫嶉幏鍡楀瀻/绾喛顓荤€电厧鍙?娑撳娴囧┃鎰瀮娴犺翰鈧秵瀵滈柦?閳?妤犲矁鐦夐幐澶愭尦閹稿鏁ら柅鏃€顒滅涵顔芥▔缁€?
## 8. 閸撳秶顏€涳妇鏁撴笟褎绁存灞藉灙鐞涖劍鏆ｉ崥?
- [x] 8.1 OnlineExamManagement.tsx 鐎涳妇鏁撻崚妤勩€冪憴鍡楁禈閿涙uestionIds 娑撹櫣鈹栭惃?Exam 閺勫墽銇?娑撳娴囩拠鏇炲祹"閹稿鎸抽敍鍫ｂ偓宀勬姜"鏉╂稑鍙嗛懓鍐槸"閿涘绱濋悙鐟板毊鐟欙箑褰傛稉瀣祰 GET /api/papers/:paperId/download-file 閳?妤犲矁鐦夐弫鏉戝祹閺夛紕娲伴弰鍓с仛娑撳娴囬幐澶愭尦
- [x] 8.2 OnlineExamManagement.tsx 闂団偓閼惧嘲褰?Exam 閸忓疇浠堥惃?ExamPaper.pdfUrl閿涘牊鍨?Exam 閸忓疇浠?paperId閿涘绱伴崥搴ｎ伂 listExams 鏉╂柨娲?include paper閿涘澃elect id, pdfUrl, purpose閿涘绱濋崜宥囶伂閻?exam.paper?.pdfUrl 閺嬪嫰鈧姳绗呮潪浠嬫懠閹?閳?妤犲矁鐦夐崥搴ｎ伂鏉╂柨娲栭崥?paper.pdfUrl
- [x] 8.3 TakeExam.tsx 鐎?questionIds=[] 閻?Exam 閺勫墽銇?濮濄倓璐熼弫鏉戝祹閼板啳鐦敍宀冾嚞娑撳娴囩拠鏇炲祹閸氬海鍤庢稉瀣╃稊缁?+ 娑撳娴囬幐澶愭尦閿涘奔绗夊〒鍙夌厠缁涙棃顣介悾宀勬桨 閳?妤犲矁鐦夌拋鍧楁６ /take-exam/:id 鐎佃鏆ｉ崡閿嬫▔缁€鐑樺絹缁€娲€?

## 9. 閺嬪嫬缂撴稉搴ㄧ崣鐠?
- [x] 9.1 閸氬海顏?`npm run build` (tsc) 缂傛牞鐦ч柅姘崇箖 閳?妤犲矁鐦?0 errors
- [x] 9.2 閸撳秶顏?`npm run build` (tsc + vite) 缂傛牞鐦ч柅姘崇箖 閳?妤犲矁鐦?0 errors
- [x] 9.3 闁插秴鎯庨崥搴ｎ伂閿涘瓖2E 濞村鐦敍姝沝min 閺佹潙宓庣€电厧鍙?PDF 閳?妤犲矁鐦?DB purpose=whole_paper + 閺?Question 閳?閸欐垵绔?閳?鐎涳妇鏁撻惂璇茬秿閻鍩屽ù瀣崣閸掓銆冮崥顐ｆ殻閸?+ 娑撳娴囬幐澶愭尦 閳?娑撳娴囬弬鍥︽閹存劕濮?閳?妤犲矁鐦夐崗銊╂懠鐠?- [x] 9.4 閸ョ偛缍婂ù瀣槸閿涙氨骞囬張澶嬪閸掑棗顕遍崗銉︾ウ缁嬪绗夐崣妤€濂栭崫宥忕礄admin 閹峰棗鍨庣€电厧鍙?PDF 閳?MinerU 鐟欙絾鐎?閳?閹峰棗鍨庢０鍕潔 閳?绾喛顓荤€电厧鍙?閳?Question 閸掓稑缂撳锝呯埗閿涘鈧?妤犲矁鐦?question_source 閻劑鈧梹顒滅敮绋夸紣娴?


