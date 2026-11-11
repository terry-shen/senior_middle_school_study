/**
 * 人教版高中化学 教材 > 章 > 节 种子数据（幂等，可重复执行）
 * 运行: node seed-taxonomy-chemistry.cjs  (工作目录 backend/)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EDITION = '人教版';

const CHEMISTRY = [
  {
    name: '必修第一册',
    grade: '高一上',
    chapters: [
      { title: '第一章 物质及其变化', sections: ['1.物质的分类及转化', '2.离子反应', '3.氧化还原反应'] },
      { title: '第二章 海水中的重要元素——钠和氯', sections: ['1.钠及其化合物', '2.氯及其化合物', '3.物质的量'] },
      { title: '第三章 铁 金属材料', sections: ['1.铁及其化合物', '2.金属材料'] },
      { title: '第四章 物质结构 元素周期律', sections: ['1.原子结构与元素周期表', '2.元素周期律', '3.化学键'] },
    ],
  },
  {
    name: '必修第二册',
    grade: '高一下',
    chapters: [
      { title: '第五章 化工生产中的重要非金属元素', sections: ['1.硫及其化合物', '2.氮及其化合物', '3.无机非金属材料'] },
      { title: '第六章 化学反应与能量', sections: ['1.化学反应与能量变化', '2.化学反应的速率与限度'] },
      { title: '第七章 有机化合物', sections: ['1.认识有机化合物', '2.乙烯与有机高分子材料', '3.乙醇与乙酸', '4.基本营养物质'] },
      { title: '第八章 化学与可持续发展', sections: ['1.自然资源的开发利用', '2.化学品的合理使用', '3.环境保护与绿色化学'] },
    ],
  },
  {
    name: '选择性必修第一册',
    grade: '高二上',
    chapters: [
      { title: '第一章 化学反应的热效应', sections: ['1.反应热', '2.反应热的计算'] },
      { title: '第二章 化学反应速率与化学平衡', sections: ['1.化学反应速率', '2.化学平衡', '3.化学反应的方向', '4.化学反应的调控'] },
      { title: '第三章 水溶液中的离子反应与平衡', sections: ['1.电离平衡', '2.水的电离和溶液的pH', '3.盐类的水解', '4.沉淀溶解平衡'] },
      { title: '第四章 化学反应与电能', sections: ['1.原电池', '2.电解池', '3.金属的腐蚀与防护'] },
    ],
  },
  {
    name: '选择性必修第二册',
    grade: '高二下',
    chapters: [
      { title: '第一章 原子结构与性质', sections: ['1.原子结构', '2.原子结构与元素的性质'] },
      { title: '第二章 分子结构与性质', sections: ['1.共价键', '2.分子的空间结构', '3.分子结构与物质的性质'] },
      { title: '第三章 晶体结构与性质', sections: ['1.物质的聚集状态与晶体的常识', '2.分子晶体与共价晶体', '3.金属晶体与离子晶体', '4.配合物与超分子'] },
    ],
  },
  {
    name: '选择性必修第三册',
    grade: '高三',
    chapters: [
      { title: '第一章 有机化合物的结构特点与研究方法', sections: ['1.有机化合物的结构特点', '2.研究有机化合物的一般方法'] },
      { title: '第二章 烃', sections: ['1.烷烃', '2.烯烃 炔烃', '3.芳香烃'] },
      { title: '第三章 烃的衍生物', sections: ['1.卤代烃', '2.醇 酚', '3.醛 酮', '4.羧酸 羧酸衍生物', '5.有机合成'] },
      { title: '第四章 生物大分子', sections: ['1.糖类', '2.蛋白质', '3.核酸'] },
      { title: '第五章 合成高分子', sections: ['1.合成高分子的基本方法', '2.高分子材料'] },
    ],
  },
];

async function seedSubject(code, books) {
  const subject = await prisma.subject.findUnique({ where: { code } });
  if (!subject) throw new Error(`subject not found: ${code}`);
  let t = 0, c = 0, s = 0;
  for (let bi = 0; bi < books.length; bi++) {
    const book = books[bi];
    let row = await prisma.textbook.findUnique({
      where: { subjectId_edition_name: { subjectId: subject.id, edition: EDITION, name: book.name } },
    });
    if (row) {
      row = await prisma.textbook.update({ where: { id: row.id }, data: { grade: book.grade, order: bi + 1 } });
    } else {
      row = await prisma.textbook.create({
        data: { subjectId: subject.id, edition: EDITION, name: book.name, grade: book.grade, order: bi + 1 },
      });
      t++;
    }
    for (let ci = 0; ci < book.chapters.length; ci++) {
      const ch = book.chapters[ci];
      let chRow = await prisma.chapter.findUnique({ where: { textbookId_order: { textbookId: row.id, order: ci + 1 } } });
      if (chRow) {
        chRow = await prisma.chapter.update({ where: { id: chRow.id }, data: { title: ch.title } });
      } else {
        chRow = await prisma.chapter.create({ data: { textbookId: row.id, order: ci + 1, title: ch.title } });
        c++;
      }
      for (let si = 0; si < ch.sections.length; si++) {
        const title = ch.sections[si];
        const sec = await prisma.section.findUnique({ where: { chapterId_order: { chapterId: chRow.id, order: si + 1 } } });
        if (sec) {
          await prisma.section.update({ where: { id: sec.id }, data: { title } });
        } else {
          await prisma.section.create({ data: { chapterId: chRow.id, order: si + 1, title } });
          s++;
        }
      }
    }
  }
  const totals = {
    textbooks: await prisma.textbook.count({ where: { subjectId: subject.id } }),
    chapters: await prisma.chapter.count({ where: { textbook: { subjectId: subject.id } } }),
    sections: await prisma.section.count({ where: { chapter: { textbook: { subjectId: subject.id } } } }),
  };
  return { code, created: { textbooks: t, chapters: c, sections: s }, totals };
}

(async () => {
  const r = await seedSubject('chemistry', CHEMISTRY);
  console.log('chemistry', JSON.stringify(r));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
