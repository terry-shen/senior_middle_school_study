// Direct test of LLM call for KP import
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const { LLMService } = require('./dist/services/llm-service');
  const llmService = new LLMService(prisma);
  
  const fs = require('fs');
  const rawText = fs.readFileSync('uploads/knowledge.txt', 'utf8');
  console.log('Input text length:', rawText.length);
  
  const truncated = rawText.substring(0, 8000);
  console.log('Truncated length:', truncated.length);
  
  const prompt = `你是一位资深高中数学教学专家。请仔细分析以下文件内容，提取其中的所有数学知识点，并进行分类组织和要点解读。

要求：
1. 从文本中识别出所有数学知识点
2. 按照层级结构组织知识点（level 1-4）
3. 为每个知识点生成编码
4. 提供简短描述和要点解读

请以JSON数组格式返回，每个元素包含：code, name, level, parentCode, description, keyPoints

待分析文本：
${truncated}

请严格返回JSON数组格式。`;

  console.log('Calling LLM...');
  console.log('Prompt length:', prompt.length);
  
  const startTime = Date.now();
  try {
    const response = await llmService.generate({
      prompt,
      maxTokens: 8192,
      temperature: 0.3,
    });
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`LLM response in ${elapsed}s`);
    console.log('Response content length:', response.content?.length || 0);
    console.log('Response content preview:', response.content?.substring(0, 500));
    console.log('---');
    console.log('Response content full:', response.content);
  } catch (err) {
    console.error('LLM call failed:', err.message);
  }
}

main().then(() => prisma.$disconnect()).catch(e => console.error(e));
