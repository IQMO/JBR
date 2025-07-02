import { User } from '@jabbr/shared';
interface InternalUser extends User {
    isEmailVerified: boolean;
    lastLoginAt: Date | null;
}
export interface IUserRepository {
    findById(id: string): Promise<InternalUser | null>;
    findByEmail(email: string): Promise<InternalUser | null>;
    create(userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser>;
    update(id: string, userData: Partial<InternalUser>): Promise<InternalUser | null>;
    delete(id: string): Promise<boolean>;
    updateLastLogin(id: string): Promise<void>;
    updatePassword(id: string, hashedPassword: string): Promise<boolean>;
    emailExists(email: string): Promise<boolean>;
}
export declare class InMemoryUserRepository implements IUserRepository {
    private users;
    private emailIndex;
    findById(id: string): Promise<InternalUser | null>;
    findByEmail(email: string): Promise<InternalUser | null>;
    create(userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser>;
    update(id: string, userData: Partial<InternalUser>): Promise<InternalUser | null>;
    delete(id: string): Promise<boolean>;
    updateLastLogin(id: string): Promise<void>;
    updatePassword(id: string, hashedPassword: string): Promise<boolean>;
    emailExists(email: string): Promise<boolean>;
    private generateId;
    findAll(): Promise<InternalUser[]>;
    clear(): Promise<void>;
    count(): Promise<number>;
}
export declare const userRepository: InMemoryUserRepository;
export declare class DatabaseUserRepository implements IUserRepository {
    constructor();
    findById(id: string): Promise<InternalUser | null>;
    findByEmail(email: string): Promise<InternalUser | null>;
    create(userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser>;
    update(id: string, userData: Partial<InternalUser>): Promise<InternalUser | null>;
    delete(id: string): Promise<boolean>;
    updateLastLogin(id: string): Promise<void>;
    updatePassword(id: string, hashedPassword: string): Promise<boolean>;
    emailExists(email: string): Promise<boolean>;
}
export {};
//# sourceMappingURL=user.repository.d.ts.map