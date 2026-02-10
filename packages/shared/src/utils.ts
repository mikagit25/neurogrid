/**
 * Common utilities for NeuroGrid platform
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// UUID utilities
export function generateId(): string {
  return uuidv4();
}

export function generateTaskId(): string {
  return `task-${uuidv4()}`;
}

export function generateNodeId(): string {
  return `node-${uuidv4()}`;
}

export function generateApiKey(): string {
  return `ng_${crypto.randomBytes(32).toString('hex')}`;
}

// Time utilities
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

export function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

// Cost calculation utilities
export function calculateTaskCost(
  tokensUsed: number,
  pricePerToken: number,
  baseNodeCost: number,
  durationSeconds: number
): number {
  const tokenCost = tokensUsed * pricePerToken;
  const timeCost = (durationSeconds / 3600) * baseNodeCost; // hourly rate
  return Math.round((tokenCost + timeCost) * 100) / 100; // round to 2 decimal places
}

export function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  return `${amount.toFixed(4)} ${currency}`;
}

// Text processing utilities
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, '');
}

export function extractKeywords(text: string, maxKeywords: number = 5): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordCount = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

// Data structure utilities
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (obj && typeof obj === 'object' && key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

// Array utilities
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }
  
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Async utilities
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        await delay(backoffMs * Math.pow(2, i));
      }
    }
  }
  
  throw lastError!;
}

export async function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), ms);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// Validation utilities
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidIPAddress(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// Crypto utilities
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashPassword(password, salt);
  return computedHash === hash;
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Performance utilities
export function measureTime<T>(fn: () => T, label?: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (label) {
    console.log(`${label} took ${(end - start).toFixed(2)}ms`);
  }
  
  return result;
}

export async function measureTimeAsync<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  
  if (label) {
    console.log(`${label} took ${(end - start).toFixed(2)}ms`);
  }
  
  return result;
}

// Error utilities
export class NeuroGridError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'NeuroGridError';
  }
}

export function createError(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: any
): NeuroGridError {
  return new NeuroGridError(message, code, statusCode, details);
}

export function isNeuroGridError(error: any): error is NeuroGridError {
  return error instanceof NeuroGridError;
}

// Logging utilities
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export function createLogEntry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date(),
    metadata
  };
}

// Math utilities
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

export function percentage(value: number, total: number): number {
  return total === 0 ? 0 : round((value / total) * 100, 1);
}

export function average(numbers: number[]): number {
  return numbers.length === 0 ? 0 : numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Export all utilities in a namespace
export const Utils = {
  generateId,
  generateTaskId,
  generateNodeId,
  generateApiKey,
  formatDuration,
  formatTimestamp,
  parseTimestamp,
  isValidTimestamp,
  calculateTaskCost,
  formatCurrency,
  truncateText,
  sanitizeText,
  extractKeywords,
  deepClone,
  omit,
  pick,
  groupBy,
  chunk,
  unique,
  shuffle,
  delay,
  retry,
  timeout,
  isValidUrl,
  isValidEmail,
  isValidIPAddress,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  generateNonce,
  measureTime,
  measureTimeAsync,
  createError,
  isNeuroGridError,
  createLogEntry,
  clamp,
  round,
  percentage,
  average,
  median
};