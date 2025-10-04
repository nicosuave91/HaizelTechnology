import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class LockCreateRequestDto {
  @IsString()
  @IsNotEmpty()
  loanId!: string;

  @IsString()
  @IsNotEmpty()
  productRef!: string;

  @IsNumber()
  rate!: number;

  @IsNumber()
  price!: number;

  @IsInt()
  @Min(15)
  @Max(180)
  lockPeriodDays!: number;
}

export class LockExtendRequestDto {
  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class LockResourceDto {
  id!: string;
  loanId!: string;
  status!: string;
  lockedAt?: string | null;
  expiresAt!: string;
  lockPeriodDays!: number;
  productRef!: string;
  rate!: number;
  price!: number;
  actions!: any[];
}
