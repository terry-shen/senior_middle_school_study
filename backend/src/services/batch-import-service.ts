/**
 * Student Batch Import Service
 * Supports CSV and Excel file import for students
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface StudentImportRow {
  studentId: string;
  name: string;
  className: string;
  grade?: string;
  password?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  createdStudents: Array<{ studentId: string; name: string }>;
}

export class BatchImportService {
  
  /**
   * Import students from CSV string
   * Expected format: studentId,name,className,grade,password
   */
  async importFromCSV(csvContent: string, defaultPassword: string = '123456'): Promise<ImportResult> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Validate headers
    const requiredHeaders = ['studentid', 'name', 'classname'];
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        throw new Error(`Missing required header: ${header}`);
      }
    }
    
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      createdStudents: []
    };
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      const row: StudentImportRow = {
        studentId: values[headers.indexOf('studentid')],
        name: values[headers.indexOf('name')],
        className: values[headers.indexOf('classname')],
        grade: values[headers.indexOf('grade')] || undefined,
        password: values[headers.indexOf('password')] || defaultPassword
      };
      
      try {
        await this.importStudent(row);
        result.success++;
        result.createdStudents.push({ studentId: row.studentId, name: row.name });
      } catch (error: any) {
        result.failed++;
        result.errors.push({ row: i + 1, message: error.message });
      }
    }
    
    return result;
  }
  
  /**
   * Import students from JSON array
   */
  async importFromJSON(students: StudentImportRow[], defaultPassword: string = '123456'): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      createdStudents: []
    };
    
    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      
      try {
        await this.importStudent({
          ...row,
          password: row.password || defaultPassword
        });
        result.success++;
        result.createdStudents.push({ studentId: row.studentId, name: row.name });
      } catch (error: any) {
        result.failed++;
        result.errors.push({ row: i + 1, message: error.message });
      }
    }
    
    return result;
  }
  
  /**
   * Import a single student
   */
  private async importStudent(row: StudentImportRow): Promise<void> {
    // Validate required fields
    if (!row.studentId || !row.name || !row.className) {
      throw new Error('Missing required fields: studentId, name, or className');
    }
    
    // Check if student already exists
    const existing = await prisma.student.findUnique({
      where: { studentId: row.studentId }
    });
    
    if (existing) {
      throw new Error(`Student with ID ${row.studentId} already exists`);
    }
    
    // Find or create class
    let classRecord = await prisma.class.findFirst({
      where: {
        name: row.className,
        grade: row.grade || '高一'
      }
    });
    
    if (!classRecord) {
      classRecord = await prisma.class.create({
        data: {
          name: row.className,
          grade: row.grade || '高一'
        }
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(row.password || '123456', 10);
    
    // Create student
    await prisma.student.create({
      data: {
        studentId: row.studentId,
        name: row.name,
        passwordHash,
        classId: classRecord.id,
        role: 'student'
      }
    });
  }
  
  /**
   * Export students to CSV
   */
  async exportToCSV(classId?: number): Promise<string> {
    const where = classId ? { classId } : {};
    
    const students = await prisma.student.findMany({
      where,
      include: { class: true },
      orderBy: { studentId: 'asc' }
    });
    
    const headers = ['studentId', 'name', 'className', 'grade', 'role'];
    const lines = [headers.join(',')];
    
    for (const student of students) {
      const row = [
        student.studentId,
        student.name,
        student.class?.name || '',
        student.class?.grade || '',
        student.role
      ];
      lines.push(row.join(','));
    }
    
    return lines.join('\n');
  }
}