import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('risk_management_templates')
export class RiskManagementTemplateEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'enum', enum: ['conservative', 'moderate', 'aggressive', 'custom'] })
  @Index()
  category: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  isDefault: boolean;

  // JSON configuration containing the full PerBotRiskManagement object
  @Column({ type: 'text' })
  configuration: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
