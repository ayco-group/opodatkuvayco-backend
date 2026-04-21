import { StockExchangeEnum } from 'src/normalizeTrades/constants/enums';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportDealsDto {
  @ApiProperty({
    enum: StockExchangeEnum,
    enumName: 'StockExchangeEnum',
    description: 'Stock exchange type',
  })
  @IsEnum(StockExchangeEnum)
  @IsNotEmpty({ message: 'Stock exchange query param is required' })
  stockExchange: StockExchangeEnum;
}
