import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum ExceptionTypeEnum {
  pricing = 'pricing',
  overlay = 'overlay',
  uw = 'uw',
}

export enum ExceptionScopeEnum {
  loan = 'loan',
  tenant = 'tenant',
}

export class ExceptionCreateRequestDto {
  @IsString()
  @IsNotEmpty()
  ruleCode!: string;

  @IsOptional()
  @IsString()
  pricingCode?: string;

  @IsEnum(ExceptionTypeEnum)
  type!: ExceptionTypeEnum;

  @IsString()
  @IsNotEmpty()
  justification!: string;

  @IsOptional()
  @IsEnum(ExceptionScopeEnum)
  scope?: ExceptionScopeEnum;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class ExceptionDecisionRequestDto {
  @IsString()
  @IsNotEmpty()
  justification!: string;
}

export interface ExceptionAuditEntryDto {
  action: string;
  actor: string;
  at: string;
  justification?: string;
}

export class ExceptionResponseDto {
  id!: string;
  loanId!: string;
  ruleCode!: string;
  pricingCode?: string | null;
  type!: string;
  status!: string;
  scope!: string;
  justification!: string;
  requestedBy!: string;
  approverUserId?: string | null;
  expiresAt?: string | null;
  createdAt!: string;
  updatedAt!: string;
  auditTrail!: ExceptionAuditEntryDto[];
}
