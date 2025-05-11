import { Types } from 'mongoose';

export const validateSpecifications = (specs?: Record<string, any>): Types.Map<string> | undefined => {
    if (!specs) return undefined;
    
    const validSpecs = new Types.Map<string>([]);
    for (const [key, value] of Object.entries(specs)) {
        if (value && typeof value === 'string') {
            validSpecs.set(key.trim(), value.substring(0, 100)); // Limitar longitud
        }
    }
    return validSpecs.size > 0 ? validSpecs : undefined;
};