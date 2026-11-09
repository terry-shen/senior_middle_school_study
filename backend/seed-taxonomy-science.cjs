/**
 * 人教版高中物理 / 生物 教材 > 章 > 节 种子数据（幂等，可重复执行）
 * 运行: node seed-taxonomy-science.cjs  (工作目录 backend/)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EDITION = '人教版';

const PHYSICS = [
  {
    name: '必修第一册',
    grade: '高一上',
    chapters: [
      { title: '第一章 运动的描述', sections: ['1.质点 参考系', '2.时间 位移', '3.位置变化快慢的描述——速度', '4.速度变化快慢的描述——加速度'] },
      { title: '第二章 匀变速直线运动的研究', sections: ['1.实验：探究小车速度随时间变化的规律', '2.匀变速直线运动的速度与时间的关系', '3.匀变速直线运动的位移与时间的关系', '4.自由落体运动'] },
      { title: '第三章 相互作用——力', sections: ['1.重力与弹力', '2.摩擦力', '3.牛顿第三定律', '4.力的合成和分解', '5.共点力的平衡'] },
      { title: '第四章 运动和力的关系', sections: ['1.牛顿第一定律', '2.实验：探究加速度与力、质量的关系', '3.牛顿第二定律', '4.力学单位制', '5.牛顿运动定律的应用', '6.超重和失重'] },
    ],
  },
  {
    name: '必修第二册',
    grade: '高一下',
    chapters: [
      { title: '第五章 抛体运动', sections: ['1.曲线运动', '2.运动的合成与分解', '3.实验：探究平抛运动的特点', '4.抛体运动的规律'] },
      { title: '第六章 圆周运动', sections: ['1.圆周运动', '2.向心力', '3.向心加速度', '4.生活中的圆周运动'] },
      { title: '第七章 万有引力与宇宙航行', sections: ['1.行星的运动', '2.万有引力定律', '3.万有引力理论的成就', '4.宇宙航行', '5.相对论时空观与牛顿力学的局限性'] },
      { title: '第八章 机械能守恒定律', sections: ['1.功与功率', '2.重力势能', '3.动能和动能定理', '4.机械能守恒定律', '5.实验：验证机械能守恒定律'] },
    ],
  },
  {
    name: '必修第三册',
    grade: '高二上',
    chapters: [
      { title: '第九章 静电场及其应用', sections: ['1.电荷', '2.库仑定律', '3.电场 电场强度', '4.静电的防止与利用'] },
      { title: '第十章 静电场中的能量', sections: ['1.电势能和电势', '2.电势差', '3.电势差与电场强度的关系', '4.电容器的电容', '5.带电粒子在电场中的运动'] },
      { title: '第十一章 电路及其应用', sections: ['1.电源和电流', '2.导体的电阻', '3.实验：导体电阻率的测量', '4.串联电路和并联电路', '5.实验：练习使用多用电表'] },
      { title: '第十二章 电能 能量守恒定律', sections: ['1.电路中的能量转化', '2.闭合电路的欧姆定律', '3.实验：电池电动势和内阻的测量', '4.能源与可持续发展'] },
      { title: '第十三章 电磁感应与电磁波初步', sections: ['1.磁场 磁感线', '2.磁感应强度 磁通量', '3.电磁感应现象及应用', '4.电磁波的发现及应用', '5.能量量子化'] },
    ],
  },
  {
    name: '选择性必修第一册',
    grade: '高二下',
    chapters: [
      { title: '第一章 动量守恒定律', sections: ['1.动量', '2.动量定理', '3.动量守恒定律', '4.实验：验证动量守恒定律'] },
      { title: '第二章 机械振动', sections: ['1.简谐运动', '2.简谐运动的描述', '3.简谐运动的回复力和能量', '4.单摆', '5.实验：用单摆测量重力加速度', '6.受迫振动 共振'] },
      { title: '第三章 机械波', sections: ['1.波的形成', '2.波的描述', '3.波的反射、折射和衍射', '4.波的干涉', '5.多普勒效应'] },
      { title: '第四章 光', sections: ['1.光的折射', '2.全反射', '3.光的干涉', '4.实验：用双缝干涉测量光的波长', '5.光的衍射', '6.光的偏振 激光'] },
    ],
  },
  {
    name: '选择性必修第二册',
    grade: '高三上',
    chapters: [
      { title: '第一章 安培力与洛伦兹力', sections: ['1.磁场对通电导线的作用力', '2.磁场对运动电荷的作用力', '3.带电粒子在匀强磁场中的运动', '4.质谱仪与回旋加速器'] },
      { title: '第二章 电磁感应', sections: ['1.楞次定律', '2.法拉第电磁感应定律', '3.涡流、电磁阻尼和电磁驱动', '4.互感和自感', '5.实验：探究影响感应电流方向的因素'] },
      { title: '第三章 交变电流', sections: ['1.交变电流', '2.交变电流的描述', '3.变压器', '4.电能的输送'] },
      { title: '第四章 电磁振荡与电磁波', sections: ['1.振荡电路', '2.电磁场和电磁波', '3.无线电波的发射和接收', '4.电磁波谱'] },
      { title: '第五章 传感器', sections: ['1.认识传感器', '2.常见传感器的工作原理及应用', '3.利用传感器制作简单的自动控制装置'] },
    ],
  },
  {
    name: '选择性必修第三册',
    grade: '高三下',
    chapters: [
      { title: '第一章 分子动理论', sections: ['1.分子动理论的基本内容', '2.实验：用油膜法估测油酸分子的大小', '3.分子运动速率分布规律', '4.分子动能和分子势能'] },
      { title: '第二章 气体、固体和液体', sections: ['1.温度和温标', '2.气体的等温变化', '3.气体的等压变化和等容变化', '4.固体', '5.液体'] },
      { title: '第三章 热力学定律', sections: ['1.功、热和内能的改变', '2.热力学第一定律', '3.能量守恒定律', '4.热力学第二定律'] },
      { title: '第四章 原子结构和波粒二象性', sections: ['1.普朗克黑体辐射理论', '2.光电效应', '3.原子的核式结构模型', '4.氢原子光谱和玻尔的原子模型', '5.粒子的波动性和量子力学的建立'] },
      { title: '第五章 原子核', sections: ['1.原子核的组成', '2.放射性元素的衰变', '3.核力与结合能', '4.核裂变与核聚变', '5.基本粒子'] },
    ],
  },
];

const BIOLOGY = [
  {
    name: '必修1 分子与细胞',
    grade: '高一上',
    chapters: [
      { title: '第1章 走近细胞', sections: ['1.细胞是生命活动的基本单位', '2.细胞的多样性和统一性'] },
      { title: '第2章 组成细胞的分子', sections: ['1.细胞中的元素和化合物', '2.细胞中的无机物', '3.细胞中的糖类和脂质', '4.蛋白质是生命活动的主要承担者', '5.核酸是遗传信息的携带者'] },
      { title: '第3章 细胞的基本结构', sections: ['1.细胞膜的结构和功能', '2.细胞器之间的分工合作', '3.细胞核的结构和功能'] },
      { title: '第4章 细胞的物质输入和输出', sections: ['1.被动运输', '2.主动运输与胞吞、胞吐'] },
      { title: '第5章 细胞的能量供应和利用', sections: ['1.降低化学反应活化能的酶', '2.细胞的能量“货币”ATP', '3.细胞呼吸的原理和应用', '4.光合作用与能量转化'] },
      { title: '第6章 细胞的生命历程', sections: ['1.细胞的增殖', '2.细胞的分化', '3.细胞的衰老和死亡'] },
    ],
  },
  {
    name: '必修2 遗传与进化',
    grade: '高一下',
    chapters: [
      { title: '第1章 遗传因子的发现', sections: ['1.孟德尔的豌豆杂交实验（一）', '2.孟德尔的豌豆杂交实验（二）'] },
      { title: '第2章 基因和染色体的关系', sections: ['1.减数分裂和受精作用', '2.基因在染色体上', '3.伴性遗传'] },
      { title: '第3章 基因的本质', sections: ['1.DNA是主要的遗传物质', '2.DNA的结构', '3.DNA的复制', '4.基因通常是有遗传效应的DNA片段'] },
      { title: '第4章 基因的表达', sections: ['1.基因指导蛋白质的合成', '2.基因表达与性状的关系'] },
      { title: '第5章 基因突变及其他变异', sections: ['1.基因突变和基因重组', '2.染色体变异', '3.人类遗传病'] },
      { title: '第6章 生物的进化', sections: ['1.生物有共同祖先的证据', '2.自然选择与适应的形成', '3.种群基因组成的变化与物种的形成', '4.协同进化与生物多样性的形成'] },
    ],
  },
  {
    name: '选择性必修1 稳态与调节',
    grade: '高二上',
    chapters: [
      { title: '第1章 人体的内环境与稳态', sections: ['1.细胞生活的环境', '2.内环境的稳态'] },
      { title: '第2章 神经调节', sections: ['1.神经调节的结构基础', '2.神经调节的基本方式', '3.神经冲动的产生和传导', '4.神经系统的分级调节', '5.人脑的高级功能'] },
      { title: '第3章 体液调节', sections: ['1.激素与内分泌系统', '2.激素调节的过程', '3.体液调节与神经调节的关系'] },
      { title: '第4章 免疫调节', sections: ['1.免疫系统的组成和功能', '2.特异性免疫', '3.免疫失调', '4.免疫学的应用'] },
      { title: '第5章 植物生命活动的调节', sections: ['1.植物生长素', '2.其他植物激素', '3.植物生长调节剂的应用', '4.环境因素参与调节植物的生命活动'] },
    ],
  },
  {
    name: '选择性必修2 生物与环境',
    grade: '高二下',
    chapters: [
      { title: '第1章 种群及其动态', sections: ['1.种群的数量特征', '2.种群数量的变化', '3.影响种群数量变化的因素'] },
      { title: '第2章 群落及其演替', sections: ['1.群落的结构', '2.群落的主要类型', '3.群落的演替'] },
      { title: '第3章 生态系统及其稳定性', sections: ['1.生态系统的结构', '2.生态系统的能量流动', '3.生态系统的物质循环', '4.生态系统的信息传递', '5.生态系统的稳定性'] },
      { title: '第4章 人与环境', sections: ['1.人类活动对生态环境的影响', '2.生物多样性及其保护', '3.生态工程'] },
    ],
  },
  {
    name: '选择性必修3 生物技术与工程',
    grade: '高三',
    chapters: [
      { title: '第1章 发酵工程', sections: ['1.传统发酵技术的应用', '2.微生物的培养技术及应用', '3.发酵工程及其应用'] },
      { title: '第2章 细胞工程', sections: ['1.植物细胞工程', '2.动物细胞工程'] },
      { title: '第3章 基因工程', sections: ['1.重组DNA技术的基本工具', '2.基因工程的基本操作程序', '3.基因工程的应用', '4.蛋白质工程的原理和应用'] },
      { title: '第4章 生物技术的安全性与伦理问题', sections: ['1.转基因产品的安全性', '2.关注生殖性克隆人', '3.禁止生物武器'] },
    ],
  },
];

async function seedSubject(code, textbooks) {
  const subject = await prisma.subject.findUnique({ where: { code } });
  if (!subject) throw new Error(`subject ${code} not found`);
  let t = 0, c = 0, s = 0;
  for (let bi = 0; bi < textbooks.length; bi++) {
    const book = textbooks[bi];
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
  const r1 = await seedSubject('physics', PHYSICS);
  const r2 = await seedSubject('biology', BIOLOGY);
  console.log('physics', JSON.stringify(r1));
  console.log('biology', JSON.stringify(r2));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
