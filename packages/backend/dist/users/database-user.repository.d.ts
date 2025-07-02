import { User } from '@jabbr/shared';
import { IUserRepository } from './user.repository';
interface InternalUser extends User {
    isEmailVerified: boolean;
    lastLoginAt: Date | null;
    emailVerificationToken?: string | null;
    emailVerificationExpiresAt?: Date | null;
    passwordResetToken?: string | null;
    passwordResetExpiresAt?: Date | null;
}
export declare class DatabaseUserRepository implements IUserRepository {
    findById(id: string): Promise<InternalUser | null>;
    findByEmail(email: string): Promise<InternalUser | null>;
    create(userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser>;
    update(id: string, userData: Partial<InternalUser>): Promise<InternalUser | null>;
    delete(id: string): Promise<boolean>;
    updateLastLogin(id: string): Promise<void>;
    updatePassword(id: string, hashedPassword: string): Promise<boolean>;
    emailExists(email: string): Promise<boolean>;
    setEmailVerificationToken(id: string, token: string, expiresAt: Date): Promise<boolean>;
    verifyEmail(token: string): Promise<InternalUser | null>;
    setPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<boolean>;
    resetPassword(token: string, newPasswordHash: string): Promise<InternalUser | null>;
    findAll(): Promise<InternalUser[]>;
    count(): Promise<number>;
    clear(): Promise<void>;
    private mapDatabaseRowToUser;
}
export declare const databaseUserRepository: DatabaseUserRepository;
export {};
//# sourceMappingURL=database-user.repository.d.ts.map