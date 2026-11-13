/**
 * 人教版高中地理 教材 > 章 > 节 种子数据（幂等，可重复执行）
 * 运行: node seed-taxonomy-geography.cjs  (工作目录 backend/)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EDITION = '人教版';

const GEOGRAPHY = [
  {
    name: '必修第一册',
    grade: '高一上',
    chapters: [
      {
        title: '第一章 宇宙中的地球',
        sections: ['1.地球的宇宙环境', '2.太阳对地球的影响', '3.地球的历史', '4.地球的圈层结构'],
      },
      {
        title: '第二章 地球上的大气',
        sections: ['1.大气的组成和垂直分层', '2.大气受热过程和大气运动'],
      },
      {
        title: '第三章 地球上的水',
        sections: ['1.水循环', '2.海水的性质', '3.海水的运动'],
      },
      {
        title: '第四章 地貌',
        sections: ['1.常见地貌类型', '2.地貌的观察'],
      },
      {
        title: '第五章 植被与土壤',
        sections: ['1.植被', '2.土壤'],
      },
      {
        title: '第六章 自然灾害',
        sections: ['1.气象灾害', '2.地质灾害', '3.防灾减灾', '4.地理信息技术在防灾减灾中的应用'],
      },
    ],
  },
  {
    name: '必修第二册',
    grade: '高一下',
    chapters: [
      {
        title: '第一章 人口',
        sections: ['1.人口分布', '2.人口迁移', '3.人口容量'],
      },
      {
        title: '第二章 乡村和城镇',
        sections: ['1.乡村和城镇空间结构', '2.城镇化', '3.地域文化与城乡景观'],
      },
      {
        title: '第三章 产业区位因素',
        sections: ['1.农业区位因素及其变化', '2.工业区位因素及其变化', '3.服务业区位因素及其变化'],
      },
      {
        title: '第四章 交通运输布局与区域发展',
        sections: ['1.区域发展对交通运输布局的影响', '2.交通运输布局对区域发展的影响'],
      },
      {
        title: '第五章 环境与发展',
        sections: ['1.人类面临的主要环境问题', '2.走向人地协调——可持续发展', '3.中国国家发展战略举例'],
      },
    ],
  },
  {
    name: '选择性必修1 自然地理基础',
    grade: '高二上',
    chapters: [
      {
        title: '第一章 地球的运动',
        sections: ['1.地球的自转和公转', '2.地球运动的地理意义'],
      },
      {
        title: '第二章 地表形态的塑造',
        sections: ['1.塑造地表形态的力量', '2.构造地貌的形成', '3.河流地貌的发育'],
      },
      {
        title: '第三章 大气的运动',
        sections: ['1.常见天气系统', '2.气压带和风带', '3.气压带和风带对气候的影响'],
      },
      {
        title: '第四章 水的运动',
        sections: ['1.陆地水体及其相互关系', '2.洋流', '3.海—气相互作用'],
      },
      {
        title: '第五章 自然环境的整体性与差异性',
        sections: ['1.自然环境的整体性', '2.自然环境的地域差异性'],
      },
    ],
  },
  {
    name: '选择性必修2 区域发展',
    grade: '高二下',
    chapters: [
      {
        title: '第一章 区域与区域发展',
        sections: ['1.多种多样的区域', '2.区域整体性和关联性'],
      },
      {
        title: '第二章 资源、环境与区域发展',
        sections: ['1.区域发展的自然环境基础', '2.生态脆弱区的综合治理', '3.资源枯竭型城市的转型发展'],
      },
      {
        title: '第三章 城市、产业与区域发展',
        sections: ['1.城市的辐射功能', '2.地区产业结构变化'],
      },
      {
        title: '第四章 区际联系与区域协调发展',
        sections: ['1.流域内协调发展', '2.资源跨区域调配', '3.产业转移', '4.国际合作'],
      },
    ],
  },
  {
    name: '选择性必修3 资源、环境与国家安全',
    grade: '高三',
    chapters: [
      {
        title: '第一章 自然环境与人类社会',
        sections: ['1.自然环境的服务功能', '2.自然资源及其利用', '3.环境问题及其危害'],
      },
      {
        title: '第二章 资源安全与国家安全',
        sections: ['1.资源安全对国家安全的影响', '2.中国的能源安全', '3.中国的耕地资源与粮食安全', '4.海洋空间资源开发与国家安全'],
      },
      {
        title: '第三章 环境安全与国家安全',
        sections: ['1.环境安全对国家安全的影响', '2.环境污染与国家安全', '3.生态保护与国家安全', '4.全球气候变化与国家安全'],
      },
      {
        title: '第四章 保障国家安全的资源、环境战略与行动',
        sections: ['1.走向生态文明', '2.国家战略与政策', '3.国际合作'],
      },
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
  const r = await seedSubject('geography', GEOGRAPHY);
  console.log('geography', JSON.stringify(r));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
