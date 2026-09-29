/**
 * Exam Service
 * Handles online exam creation, publishing, and management
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateExamData {
  title: string;
  description?: string;
  questionIds: number[];
  totalScore: number;
  duration?: number;
  startTime?: Date;
  endTime?: Date;
  creatorId: number;
  paperId?: number; // 关联整卷 ExamPaper（整卷考试时设置）
}

export interface PublishExamData {
  classIds?: number[];
  studentIds?: number[];
}

/**
 * Create a new exam
 */
export async function createExam(data: CreateExamData) {
  const exam = await prisma.exam.create({
    data: {
      title: data.title,
      description: data.description,
      questionIds: JSON.stringify(data.questionIds),
      totalScore: data.totalScore,
      duration: data.duration,
      startTime: data.startTime,
      endTime: data.endTime,
      creatorId: data.creatorId,
      paperId: data.paperId,
    },
  });
  
  return {
    ...exam,
    questionIds: JSON.parse(exam.questionIds),
  };
}

/**
 * Get exam by ID
 */
export async function getExamById(id: number) {
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, studentId: true, name: true },
      },
      paper: {
        select: { id: true, pdfUrl: true, purpose: true, title: true },
      },
      assignments: {
        include: {
          class: true,
          student: {
            select: { id: true, studentId: true, name: true },
          },
        },
      },
    },
  });
  
  if (!exam) return null;
  
  return {
    ...exam,
    questionIds: JSON.parse(exam.questionIds),
  };
}

/**
 * List exams with filters
 */
export async function listExams(filters: {
  creatorId?: number;
  status?: string;
  studentId?: number;
}) {
  const where: any = {};
  
  if (filters.creatorId) {
    where.creatorId = filters.creatorId;
  }
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.studentId) {
    // Get exams assigned to the student
    where.OR = [
      {
        assignments: {
          some: { studentId: filters.studentId },
        },
      },
      {
        assignments: {
          some: {
            class: {
              students: {
                some: { id: filters.studentId },
              },
            },
          },
        },
      },
    ];
  }
  
  const exams = await prisma.exam.findMany({
    where,
    include: {
      creator: {
        select: { id: true, studentId: true, name: true },
      },
      paper: {
        select: { id: true, pdfUrl: true, purpose: true, title: true },
      },
      _count: {
        select: { assignments: true, records: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return exams.map((exam) => ({
    ...exam,
    questionIds: JSON.parse(exam.questionIds),
  }));
}

/**
 * Publish exam to students/classes
 */
export async function publishExam(examId: number, data: PublishExamData) {
  // Create assignments
  const assignments: { examId: number; classId?: number; studentId?: number }[] = [];

  // 若未指定分配对象，默认分配给所有学生（前端可能传空对象）
  if ((!data.classIds || data.classIds.length === 0) && (!data.studentIds || data.studentIds.length === 0)) {
    const allStudents = await prisma.student.findMany({
      where: { role: 'student' },
      select: { id: true },
    });
    data.studentIds = allStudents.map((s) => s.id);
  }

  if (data.classIds) {
    for (const classId of data.classIds) {
      assignments.push({ examId, classId });
    }
  }
  
  if (data.studentIds) {
    for (const studentId of data.studentIds) {
      // Check if assignment already exists
      const existing = await prisma.examAssignment.findFirst({
        where: { examId, studentId },
      });
      if (!existing) {
        await prisma.examAssignment.create({
          data: { examId, studentId },
        });
      }
    }
  }
  
  // Update status
  await prisma.exam.update({
    where: { id: examId },
    data: { status: 'published' },
  });
  
  return getExamById(examId);
}

/**
 * Get questions for an exam
 */
export async function getExamQuestions(examId: number) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
  });
  
  if (!exam) return null;
  
  const questionIds: number[] = JSON.parse(exam.questionIds);
  
  const questions = await prisma.question.findMany({
    where: {
      id: { in: questionIds },
    },
  });
  
  // Sort by order in questionIds
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  return questionIds
    .map((id) => questionMap.get(id))
    .filter(Boolean)
    .map((q) => ({ ...q, options: parseQuestionOptions((q as any).options) }));
}

/**
 * Parse the JSON-string `options` column into a string array.
 * Returns null when empty/invalid (callers treat null as "no options").
 */
function parseQuestionOptions(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Start exam for a student
 */
export async function startExam(examId: number, studentId: number) {
  // Check if exam is accessible
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      assignments: {
        include: {
          class: {
            include: {
              students: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  
  if (!exam) {
    throw new Error('Exam not found');
  }
  
  if (exam.status !== 'published') {
    throw new Error('Exam is not published');
  }
  
  // Check if student is assigned
  const isAssigned = exam.assignments.some((a) => {
    if (a.studentId === studentId) return true;
    // Check if student is in assigned class
    if (a.classId) {
      return a.class?.students?.some((s: any) => s.id === studentId) ?? false;
    }
    return false;
  });
  
  // Check if already started
  const existingRecord = await prisma.examRecord.findUnique({
    where: {
      examId_studentId: { examId, studentId },
    },
  });
  
  if (existingRecord) {
    return existingRecord;
  }
  
  // Create new exam record
  const record = await prisma.examRecord.create({
    data: {
      examId,
      studentId,
      status: 'in_progress',
    },
  });
  
  // Create answer records for each question
  const questionIds: number[] = JSON.parse(exam.questionIds);
  await prisma.answerRecord.createMany({
    data: questionIds.map((questionId) => ({
      recordId: record.id,
      questionId,
    })),
  });
  
  return record;
}

/**
 * Save answer for a question
 */
export async function saveAnswer(
  recordId: number,
  questionId: number,
  answer: string,
  timeSpent?: number
) {
  return prisma.answerRecord.update({
    where: {
      recordId_questionId: { recordId, questionId },
    },
    data: {
      answer,
      timeSpent,
    },
  });
}

/**
 * Upload image answer
 */
export async function uploadImageAnswer(
  recordId: number,
  questionId: number,
  imageUrl: string,
  timeSpent?: number
) {
  return prisma.answerRecord.update({
    where: {
      recordId_questionId: { recordId, questionId },
    },
    data: {
      imageUrl,
      timeSpent,
    },
  });
}

/**
 * Submit exam
 */
export async function submitExam(recordId: number) {
  const record = await prisma.examRecord.findUnique({
    where: { id: recordId },
    include: {
      answers: true,
      exam: true,
    },
  });
  
  if (!record) {
    throw new Error('Record not found');
  }
  
  if (record.status !== 'in_progress') {
    throw new Error('Exam already submitted');
  }
  
  // Calculate total time
  const timeSpent = Math.floor(
    (new Date().getTime() - record.startTime.getTime()) / 1000
  );
  
  // Update record status
  return prisma.examRecord.update({
    where: { id: recordId },
    data: {
      submitTime: new Date(),
      timeSpent,
      status: 'submitted',
    },
  });
}

/**
 * Get exam record for a student
 */
export async function getExamRecord(examId: number, studentId: number) {
  return prisma.examRecord.findUnique({
    where: {
      examId_studentId: { examId, studentId },
    },
    include: {
      answers: {
        include: {
          question: true,
        },
      },
    },
  });
}

/**
 * List exam records
 */
export async function listExamRecords(filters: {
  examId?: number;
  studentId?: number;
  status?: string;
}) {
  const where: any = {};
  
  if (filters.examId) where.examId = filters.examId;
  if (filters.studentId) where.studentId = filters.studentId;
  if (filters.status) where.status = filters.status;
  
  return prisma.examRecord.findMany({
    where,
    include: {
      exam: true,
      student: {
        select: { id: true, studentId: true, name: true },
      },
    },
    orderBy: { startTime: 'desc' },
  });
}

/**
 * Delete exam
 */
export async function deleteExam(id: number) {
  return prisma.exam.delete({
    where: { id },
  });
}