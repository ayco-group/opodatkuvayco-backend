import { BadRequestException, Injectable } from '@nestjs/common';
import { NormalizeTradesService } from '../normalizeTrades/normalizeTrades.service';
import {
  FreedomFinanceCorporateAction,
  FreedomFinanceReport,
} from './types/interfaces/freedomFinance.interface';
import { IbkrReport } from './types/interfaces/ibkr.interface';
import { Report } from 'src/report/types/interfaces/report.interface';
import { Trade } from 'src/report/types/interfaces/trade.interface';
import { StockExchangeEnum } from 'src/normalizeTrades/constants/enums';
import { StockExchangeType } from './types/types/stock-exchange.type';
import { ReportReaderService } from 'src/reportReader/reportReader.service';
import { FileTypeEnum } from 'src/reportReader/consts';

@Injectable()
export class NormalizeReportsService {
  constructor(
    private normalizeTradeService: NormalizeTradesService,
    private reportReaderService: ReportReaderService,
  ) {}

  private MAP_STOCK_EXCHANGE_TO_REPORT_TYPE = {
    [StockExchangeEnum.FREEDOM_FINANCE]:
      this.normalizeFreedomFinanceReport.bind(this),
    [StockExchangeEnum.IBRK]: this.normalizeIBKRReport.bind(this),
  };

  getReportByStockExchange(
    report: any,
    stockExchange: StockExchangeType,
  ): Report<Trade> {
    // TODO: add file param type
    const readedReport = this.reportReaderService.readReport(
      report,
      FileTypeEnum.JSON,
    );

    return this.MAP_STOCK_EXCHANGE_TO_REPORT_TYPE[stockExchange](readedReport);
  }

  private normalizeFreedomFinanceReport(
    report: FreedomFinanceReport,
  ): Report<Trade> {
    return {
      dateStart: report.date_start,
      trades: this.normalizeTradeService.getNormalizedTrades(
        StockExchangeEnum.FREEDOM_FINANCE,
        report.trades.detailed,
      ),
      accountAtStart: Object.fromEntries(
        report.account_at_start.account.positions_from_ts?.ps.pos.map(
          (position) => [
            position.i.split('.').at(0).replace(/_IPO/gi, '').trim(),
            position.q,
          ],
        ),
      ),
      accountAtEnd: Object.fromEntries(
        report.account_at_end.account.positions_from_ts.ps.pos.map(
          (position) => [
            position.i.split('.').at(0).replace(/_IPO/gi, '').trim(),
            position.q,
          ],
        ),
      ),
    };
  }

  private normalizeIBKRReport(report: IbkrReport): Report<Trade> {
    const { fromDate: dateStart } =
      report.FlexQueryResponse.FlexStatements.FlexStatement;

    return {
      dateStart,
      trades: this.normalizeTradeService.getNormalizedTrades(
        StockExchangeEnum.IBRK,
        [],
      ),
    };
  }

  getDividendsByStockExchange(
    report: any,
    stockExchange: StockExchangeType,
  ): { corporateActions: FreedomFinanceCorporateAction[] } {
    const readedReport = this.reportReaderService.readReport(
      report,
      FileTypeEnum.JSON,
    );

    if (stockExchange === StockExchangeEnum.FREEDOM_FINANCE) {
      return this.normalizeFreedomFinanceDividends(readedReport);
    }

    throw new BadRequestException(
      `Dividend reports are not supported for ${stockExchange}`,
    );
  }

  private normalizeFreedomFinanceDividends(report: FreedomFinanceReport): {
    corporateActions: FreedomFinanceCorporateAction[];
  } {
    return {
      corporateActions: report.corporate_actions?.detailed || [],
    };
  }
}
