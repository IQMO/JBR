import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToOne, JoinColumn } from 'typeorm';
import { Bot } from '../bots/bot.entity';

@Entity('bot_risk_management')
@Index(['botId'], { unique: true })
export class RiskManagementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  botId: string;

  @OneToOne(() => Bot, bot => bot.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  // JSON configuration containing the full PerBotRiskManagement object
  @Column({ type: 'text' })
  configuration: string;

  // Indexed fields for quick queries and filtering
  @Column({ type: 'decimal', precision: 3, scale: 1, comment: 'Risk score (1-10)' })
  @Index()
  riskScore: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, comment: 'Maximum daily loss amount' })
  maxDailyLoss: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, comment: 'Maximum drawdown percentage' })
  maxDrawdown: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, comment: 'Maximum leverage allowed' })
  maxLeverage: number;

  @Column({ type: 'boolean', default: false, comment: 'Emergency stop flag' })
  @Index()
  emergencyStop: boolean;

  @Column({ type: 'boolean', default: true, comment: 'Risk management enabled flag' })
  @Index()
  enableRiskManagement: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
