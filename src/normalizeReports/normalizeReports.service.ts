import { BadRequestException, Injectable } from '@nestjs/common';
import { NormalizeTradesService } from '../normalizeTrades/normalizeTrades.service';
import {
  FreedomFinanceCorporateAction,
  FreedomFinanceReport,
} from './types/interfaces/freedomFinance.interface';
import { IbkrReport } from './types/interfaces/ibkr.interface';
import {
  BaseReportExtra,
  IbkrCsvReportExtra,
  Report,
} from 'src/report/types/interfaces/report.interface';
import { Trade } from 'src/report/types/interfaces/trade.interface';
import { StockExchangeEnum } from 'src/normalizeTrades/constants/enums';
import { StockExchangeType } from './types/types/stock-exchange.type';
import { ReportReaderService } from 'src/reportReader/reportReader.service';
import { FileTypeEnum } from 'src/reportReader/consts';
import { FileType } from 'src/reportReader/types';
import {
  IbkrCsvRawReport,
  IbkrCsvRawGrant,
  IbkrCsvRawTrade,
  IbkrCsvRawDividend,
  IbkrCsvRawInterest,
  IbkrCsvRawCorporateAction,
} from 'src/reportReader/types/ibkr-csv-raw.interface';
import { parseIbkrNumber } from './utils/parse-ibkr-number.util';
import {
  IbkrCsvDividend,
  IbkrCsvGrant,
  IbkrCsvInterest,
  IbkrCsvOption,
  IbkrCsvTreasuryBill,
  IbkrCsvCorporateAction,
} from './types/interfaces/ibkr-csv.interface';

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
    [StockExchangeEnum.IBRK_CSV]: this.normalizeIBKRCsvReport.bind(this),
  };

  private MAP_STOCK_EXCHANGE_TO_FILE_TYPE: Partial<
    Record<StockExchangeEnum, FileType>
  > = {
    [StockExchangeEnum.FREEDOM_FINANCE]: FileTypeEnum.JSON,
    [StockExchangeEnum.IBRK]: FileTypeEnum.XML,
    [StockExchangeEnum.IBRK_CSV]: FileTypeEnum.CSV,
  };

  getReportByStockExchange(
    report: any,
    stockExchange: StockExchangeType,
  ): Report<Trade, BaseReportExtra | IbkrCsvReportExtra> {
    const fileType =
      this.MAP_STOCK_EXCHANGE_TO_FILE_TYPE[stockExchange] ?? FileTypeEnum.JSON;
    const readedReport = this.reportReaderService.readReport(report, fileType);

    return this.MAP_STOCK_EXCHANGE_TO_REPORT_TYPE[stockExchange](readedReport);
  }

  private normalizeFreedomFinanceReport(
    report: FreedomFinanceReport,
  ): Report<Trade, BaseReportExtra> {
    return {
      dateStart: report.date_start,
      trades: this.normalizeTradeService.getNormalizedTrades(
        StockExchangeEnum.FREEDOM_FINANCE,
        report.trades.detailed,
      ),
      accountAtStart: Object.fromEntries(
        report.account_at_start.account.positions_from_ts?.ps.pos.map(
          (position) => [position.i.split('.').at(0), position.q],
        ),
      ),
      accountAtEnd: Object.fromEntries(
        report.account_at_end.account.positions_from_ts.ps.pos.map(
          (position) => [position.i.split('.').at(0), position.q],
        ),
      ),
      extra: {},
    };
  }

  private normalizeIBKRReport(
    report: IbkrReport,
  ): Report<Trade, BaseReportExtra> {
    const { fromDate: dateStart } =
      report.FlexQueryResponse.FlexStatements.FlexStatement;

    return {
      dateStart,
      trades: this.normalizeTradeService.getNormalizedTrades(
        StockExchangeEnum.IBRK,
        [],
      ),
      extra: {},
    };
  }

  private normalizeIBKRCsvReport(
    rawReport: IbkrCsvRawReport,
  ): Report<Trade, IbkrCsvReportExtra> {
    const grants = this.normalizeIbkrCsvGrants(rawReport.grants);
    const trades = this.normalizeIbkrCsvTrades(rawReport.trades, grants);

    return {
      dateStart: this.extractDateStartFromPeriod(rawReport.period),
      trades,
      extra: {
        dividends: this.normalizeIbkrCsvDividends(rawReport.dividends),
        options: this.normalizeIbkrCsvOptions(rawReport.options),
        interest: this.normalizeIbkrCsvInterest(rawReport.interest),
        grants,
        treasuryBills: this.normalizeIbkrCsvTreasuryBills(
          rawReport.treasuryBills,
        ),
        corporateActions: this.normalizeIbkrCsvCorporateActions(
          rawReport.corporateActions,
        ),
      },
    };
  }

  private extractDateStartFromPeriod(period: string): string {
    // Period format: "January 1, 2024 - December 31, 2024"
    return period.split(' - ')[0]?.trim() ?? period;
  }

  private normalizeIbkrCsvGrants(rawGrants: IbkrCsvRawGrant[]): IbkrCsvGrant[] {
    return rawGrants
      .map((g) => ({
        symbol: g['Symbol'],
        reportDate: g['Report Date'],
        description: g['Description'],
        awardDate: g['Award Date'],
        vestingDate: g['Vesting Date'],
        quantity: parseIbkrNumber(g['Quantity']),
        price: parseIbkrNumber(g['Price']),
        value: parseIbkrNumber(g['Value']),
      }))
      .sort(
        (a, b) =>
          new Date(a.vestingDate).getTime() - new Date(b.vestingDate).getTime(),
      );
  }

  private normalizeIbkrCsvTrades(
    rawTrades: IbkrCsvRawTrade[],
    grants: IbkrCsvGrant[],
  ): Trade[] {
    const symbolSet = new Set<string>(rawTrades.map((t) => t['Symbol']));

    grants.forEach((g) => symbolSet.add(g.symbol));

    const tradesBySymbol = new Map<string, IbkrCsvRawTrade[]>();
    rawTrades.forEach((t) => {
      const sym = t['Symbol'];
      if (!tradesBySymbol.has(sym)) tradesBySymbol.set(sym, []);
      tradesBySymbol.get(sym).push(t);
    });

    const result: Trade[] = [];

    for (const symbol of symbolSet) {
      const symbolTrades = tradesBySymbol.get(symbol) ?? [];
      const symbolGrants = grants.filter((g) => g.symbol === symbol);

      for (const raw of symbolTrades) {
        const quantity = parseIbkrNumber(raw['Quantity']);
        const absQuantity = Math.abs(quantity);
        const isoDate = raw['Date/Time'].replace(', ', 'T');

        result.push({
          ticker: raw['Symbol'],
          currency: raw['Currency'],
          date: isoDate,
          price: parseIbkrNumber(raw['T. Price']),
          commission: Math.abs(parseIbkrNumber(raw['Comm/Fee'])),
          quantity: absQuantity,
          operation: quantity > 0 ? 'buy' : 'sell',
        });
      }

      // Inject grant vesting as BUY trades (RSU logic from Python normalizer)
      const grantsByVestingDate = this.groupGrantsByVestingDate(symbolGrants);
      for (const [vestingDate, data] of Object.entries(grantsByVestingDate)) {
        result.push({
          ticker: symbol,
          currency: 'USD',
          date: new Date(vestingDate).toISOString(),
          price: data.price,
          commission: 0,
          quantity: data.quantity,
          operation: 'buy',
        });
      }
    }

    return result;
  }

  private groupGrantsByVestingDate(
    grants: IbkrCsvGrant[],
  ): Record<
    string,
    { quantity: number; value: number; price: number; description: string }
  > {
    const result: Record<
      string,
      { quantity: number; value: number; price: number; description: string }
    > = {};

    for (const grant of grants) {
      if (
        grant.description !== 'Stock Award Vesting' &&
        grant.description !== 'Stock Award Withholding'
      ) {
        continue;
      }
      const key = grant.vestingDate;
      if (!result[key]) {
        result[key] = {
          quantity: 0,
          value: 0,
          price: grant.price,
          description: grant.description,
        };
      }
      result[key].quantity += grant.quantity;
      result[key].value += grant.value;
    }

    return result;
  }

  private normalizeIbkrCsvOptions(
    rawOptions: IbkrCsvRawTrade[],
  ): IbkrCsvOption[] {
    return rawOptions.map((o) => ({
      ticker: o['Symbol'],
      currency: o['Currency'],
      date: o['Date/Time'],
      price: parseIbkrNumber(o['T. Price']),
      commission: parseIbkrNumber(o['Comm/Fee']),
      quantity: parseIbkrNumber(o['Quantity']),
      proceeds: parseIbkrNumber(o['Proceeds']),
      code: o['Code'],
    }));
  }

  private normalizeIbkrCsvDividends(
    rawDividends: IbkrCsvRawDividend[],
  ): IbkrCsvDividend[] {
    return rawDividends.map((d) => ({
      currency: d['Currency'],
      date: d['Date'],
      amount: parseIbkrNumber(d['Amount']),
      description: d['Description'],
    }));
  }

  private normalizeIbkrCsvInterest(
    rawInterest: IbkrCsvRawInterest[],
  ): IbkrCsvInterest[] {
    return rawInterest.map((i) => ({
      currency: i['Currency'],
      date: i['Date'],
      amount: parseIbkrNumber(i['Amount']),
      description: i['Description'],
    }));
  }

  private normalizeIbkrCsvTreasuryBills(
    rawTBills: IbkrCsvRawTrade[],
  ): IbkrCsvTreasuryBill[] {
    return rawTBills.map((t) => ({
      ticker: t['Symbol'],
      currency: t['Currency'],
      date: t['Date/Time'],
      price: parseIbkrNumber(t['T. Price']),
      commission: parseIbkrNumber(t['Comm/Fee']),
      quantity: parseIbkrNumber(t['Quantity']),
      proceeds: parseIbkrNumber(t['Proceeds']),
      profit: parseIbkrNumber(t['Realized P/L']),
    }));
  }

  private normalizeIbkrCsvCorporateActions(
    rawActions: IbkrCsvRawCorporateAction[],
  ): IbkrCsvCorporateAction[] {
    return rawActions.map((ca) => ({
      currency: ca['Currency'],
      date: ca['Date'],
      description: ca['Description'],
      realizedPL: parseIbkrNumber(ca['Realized P/L']),
    }));
  }

  getDividendsByStockExchange(
    report: any,
    stockExchange: StockExchangeType,
  ):
    | {
        source: 'freedom_finance';
        corporateActions: FreedomFinanceCorporateAction[];
      }
    | { source: 'ibkr_csv'; dividends: IbkrCsvDividend[] } {
    if (stockExchange === StockExchangeEnum.FREEDOM_FINANCE) {
      const readedReport = this.reportReaderService.readReport(
        report,
        FileTypeEnum.JSON,
      ) as FreedomFinanceReport;
      return {
        source: 'freedom_finance',
        corporateActions: readedReport.corporate_actions?.detailed || [],
      };
    }

    if (stockExchange === StockExchangeEnum.IBRK_CSV) {
      const rawReport = this.reportReaderService.readReport(
        report,
        FileTypeEnum.CSV,
      ) as IbkrCsvRawReport;
      return {
        source: 'ibkr_csv',
        dividends: this.normalizeIbkrCsvDividends(rawReport.dividends),
      };
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
