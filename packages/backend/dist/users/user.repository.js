"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseUserRepository = exports.userRepository = exports.InMemoryUserRepository = void 0;
class InMemoryUserRepository {
    users = new Map();
    emailIndex = new Map();
    async findById(id) {
        const user = this.users.get(id);
        return user || null;
    }
    async findByEmail(email) {
        const userId = this.emailIndex.get(email.toLowerCase());
        if (!userId)
            return null;
        return this.findById(userId);
    }
    async create(userData) {
        const id = this.generateId();
        const now = new Date();
        const defaultPreferences = {
            timezone: 'UTC',
            currency: 'USD',
            notifications: {
                email: true,
                browser: true,
                tradingAlerts: true,
                systemAlerts: true,
                riskAlerts: true
            },
            dashboard: {
                theme: 'dark',
                layout: 'standard',
                refreshRate: 30000
            }
        };
        const user = {
            id,
            email: userData.email.toLowerCase(),
            passwordHash: userData.passwordHash,
            role: userData.role || 'user',
            apiKeys: [],
            preferences: defaultPreferences,
            isEmailVerified: false,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now
        };
        this.users.set(id, user);
        this.emailIndex.set(user.email, id);
        return user;
    }
    async update(id, userData) {
        const existingUser = this.users.get(id);
        if (!existingUser)
            return null;
        if (userData.email && userData.email !== existingUser.email) {
            this.emailIndex.delete(existingUser.email);
            this.emailIndex.set(userData.email.toLowerCase(), id);
        }
        const updatedUser = {
            ...existingUser,
            ...userData,
            id,
            updatedAt: new Date()
        };
        this.users.set(id, updatedUser);
        return updatedUser;
    }
    async delete(id) {
        const user = this.users.get(id);
        if (!user)
            return false;
        this.users.delete(id);
        this.emailIndex.delete(user.email);
        return true;
    }
    async updateLastLogin(id) {
        const user = this.users.get(id);
        if (user) {
            user.lastLoginAt = new Date();
            user.updatedAt = new Date();
            this.users.set(id, user);
        }
    }
    async updatePassword(id, hashedPassword) {
        const user = this.users.get(id);
        if (!user)
            return false;
        user.passwordHash = hashedPassword;
        user.updatedAt = new Date();
        this.users.set(id, user);
        return true;
    }
    async emailExists(email) {
        return this.emailIndex.has(email.toLowerCase());
    }
    generateId() {
        return `user_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
    async findAll() {
        return Array.from(this.users.values());
    }
    async clear() {
        this.users.clear();
        this.emailIndex.clear();
    }
    async count() {
        return this.users.size;
    }
}
exports.InMemoryUserRepository = InMemoryUserRepository;
exports.userRepository = new InMemoryUserRepository();
class DatabaseUserRepository {
    constructor() {
    }
    async findById(id) {
        throw new Error('Database implementation not yet available');
    }
    async findByEmail(email) {
        throw new Error('Database implementation not yet available');
    }
    async create(userData) {
        throw new Error('Database implementation not yet available');
    }
    async update(id, userData) {
        throw new Error('Database implementation not yet available');
    }
    async delete(id) {
        throw new Error('Database implementation not yet available');
    }
    async updateLastLogin(id) {
        throw new Error('Database implementation not yet available');
    }
    async updatePassword(id, hashedPassword) {
        throw new Error('Database implementation not yet available');
    }
    async emailExists(email) {
        throw new Error('Database implementation not yet available');
    }
}
exports.DatabaseUserRepository = DatabaseUserRepository;
//# sourceMappingURL=user.repository.js.map