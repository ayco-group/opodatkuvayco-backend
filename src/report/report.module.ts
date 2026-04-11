import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { NormalizeTradesModule } from 'src/normalizeTrades/normalizeTrades.module';
import { NormalizeTradesService } from 'src/normalizeTrades/normalizeTrades.service';
import { NormalizeReportsModule } from 'src/normalizeReports/normalizeReports.module';
import { NormalizeReportsService } from 'src/normalizeReports/normalizeReports.service';
import { ReportReaderModule } from 'src/reportReader/reportReader.module';
import { ReportReaderService } from 'src/reportReader/reportReader.service';
import { CurrencyRateService } from 'src/currencyExchange/currencyRate.service';
import { CurrencyRateModule } from 'src/currencyExchange/currencyRate.module';
import { DateFormatModule } from 'src/dateTimeFormat/dateFormat.module';
import { DateTimeFormatService } from 'src/dateTimeFormat/dateFormat.service';
import { DealsModule } from 'src/deals/deals.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity';
import { TradeModule } from 'src/trade/trade.module';
import { ReportRepositoryService } from './reportRepository.service';
import { DividendService } from './dividend.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report]),
    CurrencyRateModule,
    NormalizeTradesModule,
    NormalizeReportsModule,
    ReportReaderModule,
    DateFormatModule,
    DealsModule,
    ReportModule,
    TradeModule,
  ],
  exports: [TypeOrmModule],
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportRepositoryService,
    CurrencyRateService,
    NormalizeTradesService,
    NormalizeReportsService,
    ReportReaderService,
    DateTimeFormatService,
    DividendService,
  ],
})
export class ReportModule {}
