import { User, UserPreferences } from '@jabbr/shared';
import { database } from '../database/database.config';
import { IUserRepository } from './user.repository';

// Extended User interface for internal use (includes additional fields not in shared types)
interface InternalUser extends User {
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  emailVerificationToken?: string | null;
  emailVerificationExpiresAt?: Date | null;
  passwordResetToken?: string | null;
  passwordResetExpiresAt?: Date | null;
}

/**
 * PostgreSQL-based User Repository Implementation
 * Replaces the in-memory storage with proper database operations
 */
export class DatabaseUserRepository implements IUserRepository {
  
  /**
   * Find user by ID
   */
  async findById(id: string): Promise<InternalUser | null> {
    const result = await database.queryOne<any>(`
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

    if (!result) return null;

    return this.mapDatabaseRowToUser(result);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<InternalUser | null> {
    const result = await database.queryOne<any>(`
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

    if (!result) return null;

    return this.mapDatabaseRowToUser(result);
  }

  /**
   * Create a new user
   */
  async create(userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser> {
    // Default user preferences matching the shared types
    const defaultPreferences: UserPreferences = {
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
        refreshRate: 30000 // 30 seconds in milliseconds
      }
    };

    const preferences = userData.preferences || defaultPreferences;

    const result = await database.queryOne<any>(`
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

  /**
   * Update user data
   */
  async update(id: string, userData: Partial<InternalUser>): Promise<InternalUser | null> {
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
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
      // No fields to update, return current user
      return this.findById(id);
    }

    // Add user ID as the last parameter
    values.push(id);

    const result = await database.queryOne<any>(`
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

    if (!result) return null;

    return this.mapDatabaseRowToUser(result);
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<boolean> {
    const result = await database.query(`
      DELETE FROM users 
      WHERE id = $1
    `, [id]);

    return Array.isArray(result) ? result.length > 0 : false;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await database.query(`
      UPDATE users 
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [id]);
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const result = await database.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [hashedPassword, id]);

    return Array.isArray(result) ? result.length > 0 : false;
  }

  /**
   * Check if email already exists
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await database.queryOne<{ exists: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists
    `, [email.toLowerCase()]);

    return result?.exists || false;
  }

  /**
   * Set email verification token
   */
  async setEmailVerificationToken(id: string, token: string, expiresAt: Date): Promise<boolean> {
    const result = await database.query(`
      UPDATE users 
      SET 
        email_verification_token = $1,
        email_verification_expires_at = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [token, expiresAt, id]);

    return Array.isArray(result) ? result.length > 0 : false;
  }

  /**
   * Verify email using verification token
   */
  async verifyEmail(token: string): Promise<InternalUser | null> {
    const result = await database.queryOne<any>(`
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

    if (!result) return null;

    return this.mapDatabaseRowToUser(result);
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    const result = await database.query(`
      UPDATE users 
      SET 
        password_reset_token = $1,
        password_reset_expires_at = $2,
        updated_at = NOW()
      WHERE email = $3
    `, [token, expiresAt, email.toLowerCase()]);

    return Array.isArray(result) ? result.length > 0 : false;
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPasswordHash: string): Promise<InternalUser | null> {
    const result = await database.queryOne<any>(`
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

    if (!result) return null;

    return this.mapDatabaseRowToUser(result);
  }

  /**
   * Get all users (for testing/admin purposes)
   */
  async findAll(): Promise<InternalUser[]> {
    const results = await database.query<any>(`
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

  /**
   * Get user count (for stats)
   */
  async count(): Promise<number> {
    const result = await database.queryOne<{ count: string }>(`
      SELECT COUNT(*) as count FROM users
    `);

    return parseInt(result?.count || '0', 10);
  }

  /**
   * Clear all users (for testing purposes)
   */
  async clear(): Promise<void> {
    await database.query('DELETE FROM users');
  }

  /**
   * Map database row to InternalUser object
   */
  private mapDatabaseRowToUser(row: any): InternalUser {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      apiKeys: [], // API keys are stored in a separate table
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

// Export the database-backed repository
export const databaseUserRepository = new DatabaseUserRepository(); 