// Canonical config validator for Target Reacher. No duplications.
import type {
  ConfigValidationResult,
  ValidationError,
  ValidationWarning
} from './interfaces'

export class ConfigValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  reset(): void {
    this.errors = [];
    this.warnings = [];
  }

  addError(field: string, message: string, code: string = 'VALIDATION_ERROR'): void {
    this.errors.push({ field, message, code });
  }

  addWarning(field: string, message: string, suggestion?: string): void {
    this.warnings.push({ field, message, suggestion });
  }

  required(obj: Record<string, unknown>, field: string, fieldName?: string): boolean {
    const name = fieldName ?? field;
    if (obj[field] === undefined || obj[field] === null) {
      this.addError(field, `${name} is required`, 'REQUIRED');
      return false;
    }
    return true;
  }

  number(obj: Record<string, unknown>, field: string, options: {
    min?: number;
    max?: number;
    integer?: boolean;
    fieldName?: string;
  } = {}): boolean {
    const name = options.fieldName ?? field;
    const value = obj[field];
    if (value === undefined) return true;
    if (typeof value !== 'number' || isNaN(value)) {
      this.addError(field, `${name} must be a number`, 'INVALID_TYPE');
      return false;
    }
    if (options.integer && !Number.isInteger(value)) {
      this.addError(field, `${name} must be an integer`, 'INVALID_TYPE');
      return false;
    }
    if (options.min !== undefined && value < options.min) {
      this.addError(field, `${name} must be at least ${options.min}`, 'OUT_OF_RANGE');
      return false;
    }
    if (options.max !== undefined && value > options.max) {
      this.addError(field, `${name} must be at most ${options.max}`, 'OUT_OF_RANGE');
      return false;
    }
    return true;
  }

  string(obj: Record<string, unknown>, field: string, options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    enum?: string[];
    fieldName?: string;
  } = {}): boolean {
    const name = options.fieldName ?? field;
    const value = obj[field];
    if (value === undefined) return true;
    if (typeof value !== 'string') {
      this.addError(field, `${name} must be a string`, 'INVALID_TYPE');
      return false;
    }
    if (options.minLength !== undefined && value.length < options.minLength) {
      this.addError(field, `${name} must be at least ${options.minLength} characters`, 'TOO_SHORT');
      return false;
    }
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      this.addError(field, `${name} must be at most ${options.maxLength} characters`, 'TOO_LONG');
      return false;
    }
    if (options.pattern && !options.pattern.test(value)) {
      this.addError(field, `${name} format is invalid`, 'INVALID_FORMAT');
      return false;
    }
    if (options.enum && !options.enum.includes(value)) {
      this.addError(field, `${name} must be one of: ${options.enum.join(', ')}`, 'INVALID_VALUE');
      return false;
    }
    return true;
  }

  object(obj: Record<string, unknown>, field: string, validator: (value: unknown) => boolean, fieldName?: string): boolean {
    const name = fieldName ?? field;
    const value = obj[field];
    if (value === undefined) return true;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.addError(field, `${name} must be an object`, 'INVALID_TYPE');
      return false;
    }
    return validator(value);
  }

  array(obj: Record<string, unknown>, field: string, options: {
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: unknown, index: number) => boolean;
    fieldName?: string;
  } = {}): boolean {
    const name = options.fieldName ?? field;
    const value = obj[field];
    if (value === undefined) return true;
    if (!Array.isArray(value)) {
      this.addError(field, `${name} must be an array`, 'INVALID_TYPE');
      return false;
    }
    if (options.minLength !== undefined && value.length < options.minLength) {
      this.addError(field, `${name} must have at least ${options.minLength} items`, 'TOO_SHORT');
      return false;
    }
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      this.addError(field, `${name} must have at most ${options.maxLength} items`, 'TOO_LONG');
      return false;
    }
    if (options.itemValidator) {
      for (let i = 0; i < value.length; i++) {
        if (!options.itemValidator(value[i], i)) {
          return false;
        }
      }
    }
    return true;
  }

  warn(condition: boolean, field: string, message: string, suggestion?: string): void {
    if (condition) {
      this.addWarning(field, message, suggestion);
    }
  }

  getResult(): ConfigValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }
}

export function validateConfig(config: Record<string, unknown>, validatorFn: (validator: ConfigValidator) => void): ConfigValidationResult {
  const validator = new ConfigValidator();
  validator.reset();
  validatorFn(validator);
  return validator.getResult();
}
