/**
 * Full validation: Create exam paper → questions → AI analysis → exam → grading → student answering → feedback
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3000/api';

async function login(sid, pw) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: sid, password: pw }),
  });
  const d = await res.json();
  if (d.success && d.token) return { token: d.token, student: d.student || d.user };
  throw new Error(`Login failed: ${JSON.stringify(d)}`);
}

async function api(token, method, ep, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${ep}`, opts);
  const txt = await res.text();
  try { return { status: res.status, data: JSON.parse(txt) }; }
  catch { return { status: res.status, data: txt }; }
}

async function main() {
  const errors = [];
  const ok = s => console.log(`  ✓ ${s}`);
  const fail = (s, e) => { console.log(`  ✗ ${s}: ${e}`); errors.push(`${s}: ${e}`); };

  console.log('========================================');
  console.log('  FULL VALIDATION (GLM-5.2)');
  console.log('========================================\n');

  // [1] Create paper + questions
  console.log('[1] Create exam paper and questions...');
  let paper = await prisma.examPaper.findFirst({ where: { title: { contains: '2026' } } });
  if (!paper) {
    paper = await prisma.examPaper.create({ data: {
      title: '2026年全国高考二卷数学卷真题及答案解析',
      source: '全国高考', year: 2026, region: '全国', examType: 'gaokao',
      status: 'completed', totalScore: 150, duration: 120,
      rawContent: 'PDF imported via API',
    }});
    ok(`Paper created: ID=${paper.id}`);
  } else { ok(`Paper exists: ID=${paper.id}`); }

  const examQs = [
    {qn:'1',content:'已知复数z满足(1+i)z=2，则z的虚部为()',type:'choice',score:5,diff:'easy',opts:{A:'-1',B:'1',C:'-i',D:'i'},ans:'B'},
    {qn:'2',content:'已知平面向量a=(1,2),b=(2,m)，若a∥b，则m的值为()',type:'choice',score:5,diff:'easy',opts:{A:'1',B:'2',C:'3',D:'4'},ans:'C'},
    {qn:'3',content:'已知集合A={x|x²-x-2<0}, B={x|x>0}，则A∩B=()',type:'choice',score:5,diff:'easy',opts:{A:'(0,2)',B:'(0,1)',C:'(1,2)',D:'(-1,∞)'},ans:'A'},
    {qn:'4',content:'双曲线C: x²/a²-y²/b²=1(a>0,b>0)的渐近线方程为y=±(1/2)x，则双曲线C的离心率为()',type:'choice',score:5,diff:'medium',opts:{A:'√5/2',B:'√5',C:'2√5/5',D:'√3'},ans:'B'},
    {qn:'5',content:'圆台下底面半径为2，上底面半径为1，母线长为√2，则圆台体积为()',type:'choice',score:5,diff:'medium',opts:{A:'7π/3',B:'14π/3',C:'7√2π/3',D:'14π'},ans:'D'},
    {qn:'6',content:'将8人分成A,B两组，每组4人，且甲乙在同一组的方法数为()',type:'choice',score:5,diff:'medium',opts:{A:'10',B:'12',C:'16',D:'24'},ans:'C'},
    {qn:'7',content:'已知z为第二象限角，sin z=3/5，则tan(z/2)的值为()',type:'choice',score:5,diff:'medium',opts:{A:'3/4',B:'4/3',C:'-3/4',D:'3'},ans:'C'},
    {qn:'8',content:'已知f(x)为定义域上的偶函数，f(1)=2, f\'(1)=3，则f(-1)+f\'(-1)的值为()',type:'choice',score:5,diff:'hard',opts:{A:'1',B:'-1',C:'5',D:'-5'},ans:'D'},
    {qn:'9',content:'已知圆C: x²+y²-4x-2y=r²(r>0)，下列正确的是（）\nA. r=2时A(0,0)在圆外\nB. r=3时圆C与y轴相切\nC. r=4时圆C与圆x²+y²=1内切\nD. 两圆相交时公共弦斜率为正',type:'choice',score:6,diff:'hard',opts:{A:'A',B:'B',C:'C',D:'D'},ans:'BC'},
    {qn:'10',content:'等差数列{an}前n项和Sn，若S4=10, S8=36，则（）\nA. a1=1\nB. d=1\nC. S10=55\nD. a10=10',type:'choice',score:6,diff:'medium',opts:{A:'A',B:'B',C:'C',D:'D'},ans:'AD'},
    {qn:'12',content:'等差数列{an}前n项和Sn，若S5=10，则a3=____。',type:'fill',score:5,diff:'easy',ans:'2'},
    {qn:'13',content:'函数f(x)=√(x-1)+ln(x²-4)的定义域为____。',type:'fill',score:5,diff:'medium',ans:'(2,+∞)'},
    {qn:'15',content:'某工厂产品首次故障时间（天）频率分布直方图：\n(1) 求第一分位数和位数\n(2) 求首次故障时间<365天的个数X的分布',type:'essay',score:13,diff:'medium',ans:'第一分位数362.5，位数377'},
    {qn:'16',content:'四棱锥P-ABCD中PA⊥底面ABCD，AB=AD=2,BC=CD=√2,∠ABC=∠ADC=90°\n(1)证明PA⊥BC\n(2)求PA与平面PBC所成角的正弦值',type:'essay',score:15,diff:'hard',ans:'(1)PA⊥BC (2)sinθ=√6/3'},
    {qn:'19',content:'已知f(x)=x³-3x²+2, x∈[0,3]\n(1)求单调区间\n(2)求[0,3]上最大最小值\n(3)求f(x)+f\'(x)最小值',type:'essay',score:17,diff:'hard',ans:'(1)增(2,3)减(0,2) (2)max=2,min=-2 (3)min=-2'},
  ];

  let existing = await prisma.question.findMany({ where: { paperId: paper.id } });
  if (existing.length === 0) {
    for (const q of examQs) {
      await prisma.question.create({ data: {
        paperId: paper.id, questionNumber: parseInt(q.qn), content: q.content,
        questionType: q.type, score: q.score, difficulty: q.diff,
        options: q.opts ? JSON.stringify(q.opts) : null, answer: q.ans, aiAnalyzed: false,
      }});
    }
    ok(`Created ${examQs.length} questions`);
  } else { ok(`Questions exist: ${existing.length}`); }

  const allQs = await prisma.question.findMany({ where: { paperId: paper.id }, orderBy: { questionNumber: 'asc' } });
  console.log(`  Total: ${allQs.length} questions`);

  // [2] Admin login
  console.log('\n[2] Admin login...');
  const { token: aToken, student: admin } = await login('admin1', 'admin123');
  ok(`Admin: ${admin.name}`);

  // [3] Papers API
  console.log('\n[3] Papers API...');
  const pRes = await api(aToken, 'GET', '/papers?limit=10');
  if (pRes.status === 200) ok(`Papers: ${(pRes.data.data||pRes.data||[]).length}`);
  else fail('Papers', `${pRes.status}`);

  // [4] Questions API
  console.log('\n[4] Questions API...');
  const qRes = await api(aToken, 'GET', '/papers/questions/all?limit=50');
  if (qRes.status === 200) ok(`Questions: ${(qRes.data.data||qRes.data||[]).length}`);
  else fail('Questions', `${qRes.status}`);

  // [5] AI Analysis (GLM-5.2)
  console.log('\n[5] AI Analysis (GLM-5.2)...');
  const tQ = allQs.find(q => q.questionType === 'choice');
  if (tQ) {
    try {
      const aRes = await api(aToken, 'POST', `/analysis/question/${tQ.id}`, {});
      if (aRes.status === 200) ok(`Analysis Q${tQ.questionNumber}: done`);
      else fail('Analysis', `${aRes.status}: ${JSON.stringify(aRes.data).substring(0,150)}`);
    } catch(e) { fail('Analysis', e.message.substring(0,150)); }
  }

  // [6] Difficulty
  console.log('\n[6] Difficulty assessment...');
  const dQ = allQs.find(q => q.questionType === 'choice' && q.difficulty === 'medium');
  if (dQ) {
    try {
      const dRes = await api(aToken, 'POST', `/difficulty/assess/${dQ.id}`, {});
      if (dRes.status === 200) ok(`Difficulty Q${dQ.questionNumber}: ${dRes.data.difficulty||'assessed'}`);
      else fail('Difficulty', `${dRes.status}`);
    } catch(e) { fail('Difficulty', e.message.substring(0,100)); }
  }

  // [7] Auto exam
  console.log('\n[7] Auto exam generation...');
  const gRes = await api(aToken, 'POST', '/exams/generate', {
    name: '验证测试卷', questionTypes: { choice: 5, fill: 2, essay: 1 },
    difficultyDistribution: { easy: 0.3, medium: 0.5, hard: 0.2 }, totalScore: 50,
  });
  if (gRes.status === 200 || gRes.status === 201) ok(`Auto exam: ${gRes.data.id||'generated'}`);
  else fail('Auto exam', `${gRes.status}: ${JSON.stringify(gRes.data).substring(0,100)}`);

  // [8] Online exam
  console.log('\n[8] Create online exam...');
  const examQIds = allQs.slice(0, 5).map(q => q.id);
  const eRes = await api(aToken, 'POST', '/online-exams', {
    title: '2026高考数学模拟测试', questionIds: examQIds, duration: 60, totalScore: 25,
  });
  let onlineExamId = null;
  if (eRes.status === 201 || eRes.status === 200) {
    onlineExamId = eRes.data.id || eRes.data.exam?.id;
    ok(`Online exam: ID=${onlineExamId}`);
    const pubRes = await api(aToken, 'POST', `/online-exams/${onlineExamId}/publish`, {});
    ok(`Published: ${pubRes.status}`);
  } else fail('Online exam', `${eRes.status}: ${JSON.stringify(eRes.data).substring(0,150)}`);

  // [9] Student login
  console.log('\n[9] Student login...');
  const { token: sToken, student: sInfo } = await login('2026001', 'student123');
  ok(`Student: ${sInfo.name} (ID:${sInfo.id})`);

  // [10] Take exam
  console.log('\n[10] Student take exam...');
  let recordId = null;
  if (onlineExamId) {
    const sRes = await api(sToken, 'POST', `/online-exams/${onlineExamId}/start`, {});
    if (sRes.status === 200 || sRes.status === 201) {
      recordId = sRes.data.id || sRes.data.recordId;
      ok(`Exam started: record=${recordId}`);
      for (const qId of examQIds) {
        const q = allQs.find(x => x.id === qId);
        let answer = q?.answer || 'A';
        if (q && q.questionNumber === 1) answer = 'A'; // wrong answer to test grading
        if (q && q.questionNumber === 3) answer = 'C'; // wrong answer
        const aRes = await api(sToken, 'POST', `/online-exams/records/${recordId}/answer`, {
          questionId: qId, answer: answer,
        });
        console.log(`  → Q${q?.questionNumber}: "${answer.substring(0,40)}" → ${aRes.status}`);
      }
      const subRes = await api(sToken, 'POST', `/online-exams/records/${recordId}/submit`, {});
      ok(`Submitted: ${subRes.status}`);
    } else fail('Start exam', `${sRes.status}: ${JSON.stringify(sRes.data).substring(0,150)}`);
  }

  // [11] Grading
  console.log('\n[11] AI Grading...');
  if (recordId) {
    const gRes2 = await api(aToken, 'POST', `/grading/batch/${recordId}`, {});
    if (gRes2.status === 200) {
      ok(`Grading: ${gRes2.data.results?.length||0} results`);
      if (gRes2.data.results) {
        for (const r of gRes2.data.results.slice(0,3)) {
          console.log(`    Q${r.questionId}: ${r.score}/${r.maxScore}`);
        }
      }
    } else fail('Grading', `${gRes2.status}: ${JSON.stringify(gRes2.data).substring(0,100)}`);
  }

  // [12] Mastery
  console.log('\n[12] Mastery...');
  const mRes = await api(sToken, 'GET', `/mastery/student/${sInfo.id}`);
  ok(`Mastery: ${mRes.status}`);

  // [13] Wrong questions
  console.log('\n[13] Wrong questions...');
  const wRes = await api(sToken, 'GET', '/wrong-questions?limit=10');
  ok(`Wrong questions: ${wRes.status}`);

  // [14] Recommendations
  console.log('\n[14] Recommendations...');
  const rRes = await api(sToken, 'GET', '/recommendation/daily');
  ok(`Daily recommendation: ${rRes.status}`);

  // [15] Learning path
  console.log('\n[15] Learning path...');
  const lpRes = await api(sToken, 'POST', '/recommendation/learning-path/generate', {});
  ok(`Learning path: ${lpRes.status}`);

  // [16] Incentive
  console.log('\n[16] Learning incentive...');
  const iRes = await api(sToken, 'GET', '/incentive/stats');
  ok(`Incentive stats: ${iRes.status}`);
  const cRes = await api(sToken, 'POST', '/incentive/check-in', {});
  ok(`Check-in: ${cRes.status}`);

  // SUMMARY
  console.log('\n========================================');
  console.log('  VALIDATION SUMMARY');
  console.log('========================================');
  console.log(`  Steps: 16 | Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('  FAILED:');
    errors.forEach(e => console.log(`    ✗ ${e}`));
  } else {
    console.log('  ALL PASSED ✓');
  }
  console.log('========================================\n');

  await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
