import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class ScenarioDto {
  @IsString()
  @IsNotEmpty()
  scenarioKey!: string;

  @IsInt()
  @Min(400)
  @Max(850)
  fico!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  ltv!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  cltv!: number;

  @IsString()
  @IsNotEmpty()
  productCode!: string;

  @IsOptional()
  @IsNumber()
  pointsCap?: number;

  @IsInt()
  @Min(15)
  @Max(180)
  lockPeriodDays!: number;

  @IsOptional()
  @IsString()
  occupancy?: string;

  @IsOptional()
  @IsNumber()
  dti?: number;

  @IsOptional()
  @IsString()
  ausFinding?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  overlays?: string[];
}

export class PricingQuoteRequestDto {
  @IsOptional()
  @IsString()
  loanId?: string;

  @ValidateNested()
  @Type(() => ScenarioDto)
  scenarioA!: ScenarioDto;

  @ValidateNested()
  @Type(() => ScenarioDto)
  scenarioB!: ScenarioDto;
}

export class PricingScenarioResponseDto {
  scenarioKey!: string;
  eligibility!: Record<string, any>;
  rate!: number;
  price!: number;
  lockPeriodDays!: number;
  llpas!: { code: string; description: string; amount: number }[];
  costItems!: { label: string; amount: number }[];
}

export class PricingComparisonDto {
  deltaRate!: number;
  deltaPrice!: number;
  llpaBreakdown!: { code: string; description: string; amount: number }[];
}

export class PricingQuoteResponseDto {
  scenarioA!: PricingScenarioResponseDto;
  scenarioB!: PricingScenarioResponseDto;
  comparison!: PricingComparisonDto;
}
