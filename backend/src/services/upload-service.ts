/**
 * File Upload Service
 * Handles file uploads for exam papers and images
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Upload directory
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const typeDir = path.join(UPLOAD_DIR, file.fieldname);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// File filter - supports PDF, images, Word, and text files
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    // Word documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    // Text files
    'text/plain', // .txt
  ];
  
  // Also check by extension for robustness (browsers may report different MIME types)
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.docx', '.doc', '.txt'];
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件格式。支持的格式：PDF、图片（PNG/JPEG）、Word（.docx/.doc）、文本（.txt）'));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

/**
 * Get file URL
 */
export function getFileUrl(filename: string, type: 'exam-papers' | 'question-images' | 'answer-images'): string {
  return `/uploads/${type}/${filename}`;
}

/**
 * Delete file
 */
export function deleteFile(filename: string, type: 'exam-papers' | 'question-images' | 'answer-images'): boolean {
  const filePath = path.join(UPLOAD_DIR, type, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Check if file exists
 */
export function fileExists(filename: string, type: 'exam-papers' | 'question-images' | 'answer-images'): boolean {
  const filePath = path.join(UPLOAD_DIR, type, filename);
  return fs.existsSync(filePath);
}