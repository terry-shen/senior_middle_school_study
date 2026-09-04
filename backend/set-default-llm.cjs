const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const configs = await prisma.lLMConfig.findMany({ select: { id: true, name: true, provider: true, modelName: true, isDefault: true } });
  console.log('LLM Configs:');
  configs.forEach(c => console.log(`  ID=${c.id} | ${c.name} | ${c.provider} | ${c.modelName} | default=${c.isDefault}`));
  
  // Set Ollama qwen2.5-coder as default
  const ollama = configs.find(c => c.provider === 'ollama' && c.modelName.includes('qwen2.5-coder'));
  if (ollama) {
    await prisma.lLMConfig.updateMany({ where: {}, data: { isDefault: false } });
    await prisma.lLMConfig.update({ where: { id: ollama.id }, data: { isDefault: true } });
    console.log(`\nDefault set to: ID=${ollama.id} ${ollama.name}`);
  } else {
    console.log('\nNo Ollama config found!');
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
