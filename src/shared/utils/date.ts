import { DailyCase } from '../types';
import { cases } from '../data/cases';

export function getCaseForDate(currentDate: Date): DailyCase {
    const startDate = new Date('2026-06-17T00:00:00Z');
    // Normalize both dates to midnight UTC to ensure deterministic calculation
    const currentUTC = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
    const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    
    const diffTime = Math.max(0, currentUTC - startUTC);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // cases array is imported from data/cases.ts (contains Case objects)
    const caseIndex = diffDays % cases.length;
    const selectedCase = cases[caseIndex];
    
    if (!selectedCase) {
        throw new Error('Failed to load case');
    }
    
    return {
        ...selectedCase,
        dayNumber: diffDays + 1
    };
}
