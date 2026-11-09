/**
 * 人教A版高中数学 教材 > 章 > 节 种子数据（幂等，可重复执行）
 * 运行: node seed-taxonomy.cjs  (工作目录 backend/)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EDITION = '人教A';

// 每册: name, grade, chapters: [ { title, sections: [节标题...] } ]
const TEXTBOOKS = [
  {
    name: '必修第一册',
    grade: '高一上',
    chapters: [
      {
        title: '第一章 集合与常用逻辑用语',
        sections: [
          '1.1 集合的概念',
          '1.2 集合间的基本关系',
          '1.3 集合的基本运算',
          '1.4 充分条件与必要条件',
          '1.5 全称量词与存在量词',
        ],
      },
      {
        title: '第二章 一元二次函数、方程和不等式',
        sections: ['2.1 等式性质与不等式性质', '2.2 基本不等式', '2.3 二次函数与一元二次方程、不等式'],
      },
      {
        title: '第三章 函数的概念与性质',
        sections: [
          '3.1 函数的概念及其表示',
          '3.2 函数的基本性质',
          '3.3 幂函数',
          '3.4 函数的应用（一）',
        ],
      },
      {
        title: '第四章 指数函数与对数函数',
        sections: [
          '4.1 指数',
          '4.2 指数函数',
          '4.3 对数',
          '4.4 对数函数',
          '4.5 函数的应用（二）',
        ],
      },
      {
        title: '第五章 三角函数',
        sections: [
          '5.1 任意角和弧度制',
          '5.2 三角函数的概念',
          '5.3 诱导公式',
          '5.4 三角函数的图象与性质',
          '5.5 三角恒等变换',
          '5.6 函数 y=Asin(ωx+φ)',
          '5.7 三角函数的应用',
        ],
      },
    ],
  },
  {
    name: '必修第二册',
    grade: '高一下',
    chapters: [
      {
        title: '第六章 平面向量及其应用',
        sections: [
          '6.1 平面向量的概念',
          '6.2 平面向量的运算',
          '6.3 平面向量基本定理及坐标表示',
          '6.4 平面向量的应用',
        ],
      },
      {
        title: '第七章 复数',
        sections: ['7.1 复数的概念', '7.2 复数的四则运算', '7.3 复数的三角表示'],
      },
      {
        title: '第八章 立体几何初步',
        sections: [
          '8.1 基本立体图形',
          '8.2 立体图形的直观图',
          '8.3 简单几何体的表面积与体积',
          '8.4 空间点、直线、平面之间的位置关系',
          '8.5 空间直线、平面的平行',
          '8.6 空间直线、平面的垂直',
        ],
      },
      {
        title: '第九章 统计',
        sections: ['9.1 随机抽样', '9.2 用样本估计总体', '9.3 统计分析案例'],
      },
      {
        title: '第十章 概率',
        sections: ['10.1 随机事件与概率', '10.2 事件的相互独立性', '10.3 频率与概率'],
      },
    ],
  },
  {
    name: '选择性必修第一册',
    grade: '高二上',
    chapters: [
      {
        title: '第一章 空间向量与立体几何',
        sections: [
          '1.1 空间向量及其运算',
          '1.2 空间向量基本定理',
          '1.3 空间向量及其运算的坐标表示',
          '1.4 空间向量的应用',
        ],
      },
      {
        title: '第二章 直线和圆的方程',
        sections: [
          '2.1 直线的倾斜角与斜率',
          '2.2 直线的方程',
          '2.3 直线的交点坐标与距离公式',
          '2.4 圆的方程',
          '2.5 直线与圆、圆与圆的位置关系',
        ],
      },
      {
        title: '第三章 圆锥曲线的方程',
        sections: ['3.1 椭圆', '3.2 双曲线', '3.3 抛物线'],
      },
    ],
  },
  {
    name: '选择性必修第二册',
    grade: '高二下',
    chapters: [
      {
        title: '第四章 数列',
        sections: ['4.1 数列的概念', '4.2 等差数列', '4.3 等比数列', '4.4 数学归纳法'],
      },
      {
        title: '第五章 一元函数的导数及其应用',
        sections: ['5.1 导数的概念及其意义', '5.2 导数的运算', '5.3 导数在研究函数中的应用'],
      },
    ],
  },
  {
    name: '选择性必修第三册',
    grade: '高三',
    chapters: [
      {
        title: '第六章 计数原理',
        sections: ['6.1 分类加法计数原理与分步乘法计数原理', '6.2 排列与组合', '6.3 二项式定理'],
      },
      {
        title: '第七章 随机变量及其分布',
        sections: [
          '7.1 条件概率与全概率公式',
          '7.2 离散型随机变量及其分布列',
          '7.3 离散型随机变量的数字特征',
          '7.4 二项分布与超几何分布',
          '7.5 正态分布',
        ],
      },
      {
        title: '第八章 成对数据的统计分析',
        sections: ['8.1 成对数据的统计相关性', '8.2 一元线性回归模型及其应用', '8.3 列联表与独立性检验'],
      },
    ],
  },
];

async function main() {
  const math = await prisma.subject.findUnique({ where: { code: 'math' } });
  if (!math) throw new Error('subject code=math not found');

  let tbCreated = 0;
  let chCreated = 0;
  let secCreated = 0;

  for (let i = 0; i < TEXTBOOKS.length; i++) {
    const t = TEXTBOOKS[i];
    const existing = await prisma.textbook.findUnique({
      where: { subjectId_edition_name: { subjectId: math.id, edition: EDITION, name: t.name } },
    });
    const tb = existing
      ? await prisma.textbook.update({
          where: { id: existing.id },
          data: { grade: t.grade, order: i + 1 },
        })
      : await prisma.textbook.create({
          data: { subjectId: math.id, name: t.name, edition: EDITION, grade: t.grade, order: i + 1 },
        });
    if (!existing) tbCreated++;

    for (let j = 0; j < t.chapters.length; j++) {
      const c = t.chapters[j];
      const chOrder = j + 1;
      const existingCh = await prisma.chapter.findUnique({
        where: { textbookId_order: { textbookId: tb.id, order: chOrder } },
      });
      const ch = existingCh
        ? await prisma.chapter.update({ where: { id: existingCh.id }, data: { title: c.title } })
        : await prisma.chapter.create({ data: { textbookId: tb.id, order: chOrder, title: c.title } });
      if (!existingCh) chCreated++;

      for (let k = 0; k < c.sections.length; k++) {
        const secOrder = k + 1;
        const existingSec = await prisma.section.findUnique({
          where: { chapterId_order: { chapterId: ch.id, order: secOrder } },
        });
        if (existingSec) {
          await prisma.section.update({ where: { id: existingSec.id }, data: { title: c.sections[k] } });
        } else {
          await prisma.section.create({ data: { chapterId: ch.id, order: secOrder, title: c.sections[k] } });
          secCreated++;
        }
      }
    }
  }

  const totals = {
    textbooks: await prisma.textbook.count({ where: { subjectId: math.id } }),
    chapters: await prisma.chapter.count(),
    sections: await prisma.section.count(),
  };
  console.log(
    `created(textbook/chapter/section)=${tbCreated}/${chCreated}/${secCreated} totals=${JSON.stringify(totals)}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
