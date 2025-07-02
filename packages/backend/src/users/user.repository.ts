import { User, UserPreferences } from '@jabbr/shared';

// Extended User interface for internal use (includes additional fields not in shared types)
interface InternalUser extends User {
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
}

// For now, using in-memory storage. In production, this would connect to a real database
// This interface defines the contract for user data access
export interface IUserRepository {
  findById(_id: string): Promise<InternalUser | null>;
  findByEmail(_email: string): Promise<InternalUser | null>;
  create(_userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser>;
  update(_id: string, _userData: Partial<InternalUser>): Promise<InternalUser | null>;
  delete(_id: string): Promise<boolean>;
  updateLastLogin(_id: string): Promise<void>;
  updatePassword(_id: string, _hashedPassword: string): Promise<boolean>;
  emailExists(_email: string): Promise<boolean>;
}

/**
 * In-memory user repository implementation
 * In production, this would be replaced with a database implementation
 */
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, InternalUser> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email -> userId mapping

  /**
   * Find user by ID
   */
  async findById(_id: string): Promise<InternalUser | null> {
    const user = this.users.get(_id);
    return user || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(_email: string): Promise<InternalUser | null> {
    const userId = this.emailIndex.get(_email.toLowerCase());
    if (!userId) return null;
    return this.findById(userId);
  }

  /**
   * Create a new user
   */
  async create(_userData: Omit<InternalUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternalUser> {
    const id = this.generateId();
    const now = new Date();

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

    const user: InternalUser = {
      id,
      email: _userData.email.toLowerCase(),
      passwordHash: _userData.passwordHash,
      role: _userData.role || 'user',
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

  /**
   * Update user data
   */
  async update(_id: string, _userData: Partial<InternalUser>): Promise<InternalUser | null> {
    const existingUser = this.users.get(_id);
    if (!existingUser) return null;

    // If email is being updated, update the email index
    if (_userData.email && _userData.email !== existingUser.email) {
      this.emailIndex.delete(existingUser.email);
      this.emailIndex.set(_userData.email.toLowerCase(), _id);
    }

    const updatedUser: InternalUser = {
      ...existingUser,
      ..._userData,
      id: _id, // Ensure ID cannot be changed
      updatedAt: new Date()
    };

    this.users.set(_id, updatedUser);
    return updatedUser;
  }

  /**
   * Delete user
   */
  async delete(_id: string): Promise<boolean> {
    const user = this.users.get(_id);
    if (!user) return false;

    this.users.delete(_id);
    this.emailIndex.delete(user.email);
    return true;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(_id: string): Promise<void> {
    const user = this.users.get(_id);
    if (user) {
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
      this.users.set(_id, user);
    }
  }

  /**
   * Update user password
   */
  async updatePassword(_id: string, _hashedPassword: string): Promise<boolean> {
    const user = this.users.get(_id);
    if (!user) return false;

    user.passwordHash = _hashedPassword;
    user.updatedAt = new Date();
    this.users.set(_id, user);
    return true;
  }

  /**
   * Check if email already exists
   */
  async emailExists(_email: string): Promise<boolean> {
    return this.emailIndex.has(_email.toLowerCase());
  }

  /**
   * Generate a unique ID
   * In production, this would use UUID or database auto-increment
   */
  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Get all users (for testing/admin purposes)
   */
  async findAll(): Promise<InternalUser[]> {
    return Array.from(this.users.values());
  }

  /**
   * Clear all users (for testing purposes)
   */
  async clear(): Promise<void> {
    this.users.clear();
    this.emailIndex.clear();
  }

  /**
   * Get user count (for stats)
   */
  async count(): Promise<number> {
    return this.users.size;
  }
}

// Export singleton instance
export const userRepository = new InMemoryUserRepository();

/**
 * Database User Repository (PostgreSQL/MySQL implementation example)
 * This would be used in production with a real database
 */
export class DatabaseUserRepository implements IUserRepository {
  // private db: Database; // Your database connection

  constructor(/* database connection */) {
    // Initialize database connection
  }

  async findById(): Promise<InternalUser | null> {
    // Implementation would query the database
    throw new Error('Database implementation not yet available');
  }

  async findByEmail(): Promise<InternalUser | null> {
    // Implementation would query the database
    throw new Error('Database implementation not yet available');
  }

  async create(): Promise<InternalUser> {
    // Implementation would insert into database
    throw new Error('Database implementation not yet available');
  }

  async update(): Promise<InternalUser | null> {
    // Implementation would update database record
    throw new Error('Database implementation not yet available');
  }

  async delete(): Promise<boolean> {
    // Implementation would delete from database
    throw new Error('Database implementation not yet available');
  }

  async updateLastLogin(): Promise<void> {
    // Implementation would update last_login_at in database
    throw new Error('Database implementation not yet available');
  }

  async updatePassword(): Promise<boolean> {
    // Implementation would update password_hash in database
    throw new Error('Database implementation not yet available');
  }

  async emailExists(): Promise<boolean> {
    // Implementation would check if email exists in database
    throw new Error('Database implementation not yet available');
  }
} 