# Implementation Tasks

## Group 1: Sidebar 缁勪欢

- [x] 1.1 鏂板缓 `frontend/src/components/Sidebar.tsx`锛歳ole 鍒嗘祦锛坅dmin 6 鍒嗙粍 / student 4 椤癸級锛寀seLocation 楂樹寒 active 璺敱锛宻idebarOpen state 鎺у埗绉诲姩绔?drawer
- [x] 1.2 鏂板缓 `frontend/src/components/Sidebar.css`锛?20px 鍥哄畾瀹藉害銆佸垎缁勬爣棰樻牱寮忋€乮tem hover/active 鏍峰紡銆丂media 768px drawer锛坱ranslateX + backdrop + hamburger 鎸夐挳锛?- [x] 1.3 `App.tsx`锛氬垹闄?NavDropdown 缁勪欢 + import锛屾浛鎹负 `<Sidebar />`锛涙牴瀹瑰櫒鏀?flex 甯冨眬锛圫idebar + main flex:1锛?- [x] 1.4 `App.css`锛氬垹闄ら《閮ㄥ鑸?dropdown 鐩稿叧鏍峰紡锛屾柊澧?.app-layout / .main-content 鏍峰紡

## Group 2: 宸ヤ綔鍙伴椤?
- [x] 2.1 鏂板缓 `frontend/src/pages/Workbench.tsx`锛氱鐞嗗憳宸ヤ綔鍙帮紙5 缁熻鍗＄墖锛氳瘯鍗锋€绘暟/棰樼洰鎬绘暟/瀛︾敓鎬绘暟/鑰冭瘯鎬绘暟/寰呮壒鏀圭瓟棰樼焊鏁帮級+ 瀛︾敓宸ヤ綔鍙帮紙4 鍗＄墖锛氬緟瀹屾垚鑰冭瘯/閿欓鎬绘暟/宸叉帉鎻￠敊棰?瀛︿範杩炵画澶╂暟锛?- [x] 2.2 `Workbench.tsx`锛歅romise.allSettled 骞惰璋冪敤鏃㈡湁 API锛坧apers/questions/all/students/exam-sessions/answer-sheets 鎴?student 瀵瑰簲 API锛夛紝閮ㄥ垎澶辫触鏃跺崱鐗囨樉绀恒€?-銆?- [x] 2.3 鏂板缓 `frontend/src/pages/Workbench.css`锛氱粺璁″崱鐗囩綉鏍煎竷灞€锛坅uto-fill minmax 200px锛夈€佸崱鐗囨暟瀛?鏍囩鏍峰紡
- [x] 2.4 `App.tsx`锛氶椤佃矾鐢?/ 浠庢覆鏌?dashboard feature-cards 鏀逛负娓叉煋 `<Workbench />`锛涘垹闄?dashboard feature-cards 鐩稿叧浠ｇ爜 + CSS

## Group 3: 鐭ヨ瘑鐐瑰叆鍙ｅ悎骞?
- [x] 3.1 `frontend/src/pages/KnowledgePointManagement.tsx`锛氬垪琛ㄩ〉鏍囬鏍忓伐鍏峰尯宸叉湁銆屽鍏?Word銆嶆寜閽紙decouple-knowledge 鍙樻洿宸插疄鐜帮紝纭淇濈暀锛?- [x] 3.2 `KnowledgePointManagement.css`锛氬伐鍏锋爮鎸夐挳鏍峰紡宸插瓨鍦紙btn btn-secondary 椋庢牸锛?- [x] 3.3 `Sidebar.tsx`锛氱煡璇嗙偣鏂囨。鍒嗙粍浠呮樉绀恒€岀煡璇嗙偣鍒楄〃銆嶄竴涓叆鍙ｏ紙涓嶆樉绀虹嫭绔嬨€岀煡璇嗙偣瀵煎叆銆嶉」锛?- [x] 3.4 纭 `/knowledge-points/import` 璺敱淇濈暀涓嶅彉锛堝鍏ラ〉闈㈠拰娴佺▼涓嶆敼鍔級

## Group 4: 楠岃瘉

- [x] 4.1 鍓嶇 `npm run build`锛坱sc + vite锛夌紪璇戦€氳繃锛? 閿欒锛?73ms锛?- [x] 4.2 娴忚鍣ㄩ獙璇侊紙Playwright锛夛細admin 鐧诲綍 鈫?渚ц竟鏍?6 鍒嗙粍鍏ㄩ儴鍙 + active 楂樹寒 鈫?鐭ヨ瘑鐐瑰垪琛ㄩ〉宸ュ叿鏍忋€屽鍏ャ€嶆寜閽?鈫?宸ヤ綔鍙伴椤?5 缁熻鍗＄墖
- [x] 4.3 娴忚鍣ㄩ獙璇侊細瀛︾敓鐧诲綍 鈫?渚ц竟鏍?4 椤?+ active 楂樹寒 鈫?瀛︾敓宸ヤ綔鍙?4 鍗＄墖
- [x] 4.4 绉诲姩绔獙璇侊細绐楀彛缂╄嚦 768px 鈫?渚ц竟鏍忔敹璧?+ 姹夊牎鎸夐挳 鈫?鐐瑰嚮灞曞紑 drawer 鈫?閫夋嫨椤瑰悗鑷姩鏀惰捣
- [x] 4.5 鍥炲綊楠岃瘉锛氭棦鏈夎矾鐢憋紙/paper-library /question-bank /questions /mock-exams /wrong-questions /answer-sheets /incentive /llm-management锛夊潎鍙甯歌闂?