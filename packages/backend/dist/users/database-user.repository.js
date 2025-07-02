"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseUserRepository = exports.DatabaseUserRepository = void 0;
const database_config_1 = require("../database/database.config");
class DatabaseUserRepository {
    async findById(id) {
        const result = await database_config_1.database.queryOne(`
      SELECT 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users 
      WHERE id = $1
    `, [id]);
        if (!result)
            return null;
        return this.mapDatabaseRowToUser(result);
    }
    async findByEmail(email) {
        const result = await database_config_1.database.queryOne(`
      SELECT 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users 
      WHERE email = $1
    `, [email.toLowerCase()]);
        if (!result)
            return null;
        return this.mapDatabaseRowToUser(result);
    }
    async create(userData) {
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
        const preferences = userData.preferences || defaultPreferences;
        const result = await database_config_1.database.queryOne(`
      INSERT INTO users (
        email,
        password_hash,
        role,
        preferences,
        is_email_verified
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [
            userData.email.toLowerCase(),
            userData.passwordHash,
            userData.role || 'user',
            JSON.stringify(preferences),
            userData.isEmailVerified || false
        ]);
        if (!result) {
            throw new Error('Failed to create user');
        }
        return this.mapDatabaseRowToUser(result);
    }
    async update(id, userData) {
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        if (userData.email !== undefined) {
            updateFields.push(`email = $${paramIndex++}`);
            values.push(userData.email.toLowerCase());
        }
        if (userData.passwordHash !== undefined) {
            updateFields.push(`password_hash = $${paramIndex++}`);
            values.push(userData.passwordHash);
        }
        if (userData.role !== undefined) {
            updateFields.push(`role = $${paramIndex++}`);
            values.push(userData.role);
        }
        if (userData.preferences !== undefined) {
            updateFields.push(`preferences = $${paramIndex++}`);
            values.push(JSON.stringify(userData.preferences));
        }
        if (userData.isEmailVerified !== undefined) {
            updateFields.push(`is_email_verified = $${paramIndex++}`);
            values.push(userData.isEmailVerified);
        }
        if (userData.emailVerificationToken !== undefined) {
            updateFields.push(`email_verification_token = $${paramIndex++}`);
            values.push(userData.emailVerificationToken);
        }
        if (userData.emailVerificationExpiresAt !== undefined) {
            updateFields.push(`email_verification_expires_at = $${paramIndex++}`);
            values.push(userData.emailVerificationExpiresAt);
        }
        if (userData.lastLoginAt !== undefined) {
            updateFields.push(`last_login_at = $${paramIndex++}`);
            values.push(userData.lastLoginAt);
        }
        if (userData.passwordResetToken !== undefined) {
            updateFields.push(`password_reset_token = $${paramIndex++}`);
            values.push(userData.passwordResetToken);
        }
        if (userData.passwordResetExpiresAt !== undefined) {
            updateFields.push(`password_reset_expires_at = $${paramIndex++}`);
            values.push(userData.passwordResetExpiresAt);
        }
        if (updateFields.length === 0) {
            return this.findById(id);
        }
        values.push(id);
        const result = await database_config_1.database.queryOne(`
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, values);
        if (!result)
            return null;
        return this.mapDatabaseRowToUser(result);
    }
    async delete(id) {
        const result = await database_config_1.database.query(`
      DELETE FROM users 
      WHERE id = $1
    `, [id]);
        return Array.isArray(result) ? result.length > 0 : false;
    }
    async updateLastLogin(id) {
        await database_config_1.database.query(`
      UPDATE users 
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [id]);
    }
    async updatePassword(id, hashedPassword) {
        const result = await database_config_1.database.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [hashedPassword, id]);
        return Array.isArray(result) ? result.length > 0 : false;
    }
    async emailExists(email) {
        const result = await database_config_1.database.queryOne(`
      SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists
    `, [email.toLowerCase()]);
        return result?.exists || false;
    }
    async setEmailVerificationToken(id, token, expiresAt) {
        const result = await database_config_1.database.query(`
      UPDATE users 
      SET 
        email_verification_token = $1,
        email_verification_expires_at = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [token, expiresAt, id]);
        return Array.isArray(result) ? result.length > 0 : false;
    }
    async verifyEmail(token) {
        const result = await database_config_1.database.queryOne(`
      UPDATE users 
      SET 
        is_email_verified = true,
        email_verification_token = NULL,
        email_verification_expires_at = NULL,
        updated_at = NOW()
      WHERE 
        email_verification_token = $1 
        AND email_verification_expires_at > NOW()
        AND is_email_verified = false
      RETURNING 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [token]);
        if (!result)
            return null;
        return this.mapDatabaseRowToUser(result);
    }
    async setPasswordResetToken(email, token, expiresAt) {
        const result = await database_config_1.database.query(`
      UPDATE users 
      SET 
        password_reset_token = $1,
        password_reset_expires_at = $2,
        updated_at = NOW()
      WHERE email = $3
    `, [token, expiresAt, email.toLowerCase()]);
        return Array.isArray(result) ? result.length > 0 : false;
    }
    async resetPassword(token, newPasswordHash) {
        const result = await database_config_1.database.queryOne(`
      UPDATE users 
      SET 
        password_hash = $1,
        password_reset_token = NULL,
        password_reset_expires_at = NULL,
        updated_at = NOW()
      WHERE 
        password_reset_token = $2 
        AND password_reset_expires_at > NOW()
      RETURNING 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `, [newPasswordHash, token]);
        if (!result)
            return null;
        return this.mapDatabaseRowToUser(result);
    }
    async findAll() {
        const results = await database_config_1.database.query(`
      SELECT 
        id,
        email,
        password_hash as "passwordHash",
        role,
        preferences,
        is_email_verified as "isEmailVerified",
        email_verification_token as "emailVerificationToken",
        email_verification_expires_at as "emailVerificationExpiresAt",
        last_login_at as "lastLoginAt",
        password_reset_token as "passwordResetToken",
        password_reset_expires_at as "passwordResetExpiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users 
      ORDER BY created_at DESC
    `);
        return results.map(row => this.mapDatabaseRowToUser(row));
    }
    async count() {
        const result = await database_config_1.database.queryOne(`
      SELECT COUNT(*) as count FROM users
    `);
        return parseInt(result?.count || '0', 10);
    }
    async clear() {
        await database_config_1.database.query('DELETE FROM users');
    }
    mapDatabaseRowToUser(row) {
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role,
            apiKeys: [],
            preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences,
            isEmailVerified: row.isEmailVerified,
            emailVerificationToken: row.emailVerificationToken,
            emailVerificationExpiresAt: row.emailVerificationExpiresAt,
            lastLoginAt: row.lastLoginAt,
            passwordResetToken: row.passwordResetToken,
            passwordResetExpiresAt: row.passwordResetExpiresAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }
}
exports.DatabaseUserRepository = DatabaseUserRepository;
exports.databaseUserRepository = new DatabaseUserRepository();
//# sourceMappingURL=database-user.repository.js.map