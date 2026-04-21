import { Module } from '@nestjs/common';
import { ReportReaderService } from './reportReader.service';
import { IbkrCsvParserService } from './ibkr-csv-parser.service';

@Module({
  providers: [ReportReaderService, IbkrCsvParserService],
  exports: [ReportReaderService],
})
export class ReportReaderModule {}
