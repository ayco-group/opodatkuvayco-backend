import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NormalizeReportsService } from '../normalizeReports/normalizeReports.service';
import { GroupedTrades } from './types/interfaces/trade.interface';
import { Deal } from './types/interfaces/deal.interface';
import {
  AccounAtStartType,
  ReportFromPreviousPeriod,
} from './types/interfaces/report.interface';
import {
  DEFAULT_MILITARY_FEE,
  DEFAULT_DEALS_TAX_FEE,
  TAX_CONFIG_KEYS,
} from './consts/tax-fee-percentages';
import { DealsService } from '../deals/deals.service';
import { User } from 'src/user/entities/user.entity';
import { StockExchangeEnum } from 'src/normalizeTrades/constants/enums';
import { TradeService } from 'src/trade/trade.service';
import { mergeDeepWith, concat, pipe, map, sort } from 'ramda';
import { ReportRepositoryService } from './reportRepository.service';
import { DividendService } from './dividend.service';
import { DividendReport } from './types/interfaces/dividend.interface';

@Injectable()
export class ReportService {
  private readonly dealsTaxFee: number;
  private readonly dealsMilitaryFee: number;

  constructor(
    private reportRepositoryService: ReportRepositoryService,
    private normalizeReportsService: NormalizeReportsService,
    private dealsService: DealsService,
    private dividendService: DividendService,
    private configService: ConfigService,
  ) {
    this.dealsTaxFee = this.configService.get<number>(
      TAX_CONFIG_KEYS.DEALS_TAX_FEE,
      DEFAULT_DEALS_TAX_FEE,
    );
    this.dealsMilitaryFee = this.configService.get<number>(
      TAX_CONFIG_KEYS.MILITARY_FEE,
      DEFAULT_MILITARY_FEE,
    );
  }

  getTradesReport(file: Express.Multer.File, stockExchange: StockExchangeEnum) {
    const { trades, accountAtStart, accountAtEnd, dateStart, extra } =
      this.normalizeReportsService.getReportByStockExchange(
        file,
        stockExchange,
      );

    const groupedTrades = this.dealsService.groupTradesByTicker(trades);

    return {
      groupedTrades,
      accountAtStart,
      accountAtEnd,
      dateStart,
      extra,
    };
  }

  getTradesByMultipleFiles(
    files: Express.Multer.File[],
    stockExchange: StockExchangeEnum,
  ) {
    return pipe(
      map((file: Express.Multer.File) => {
        const {
          groupedTrades,
          accountAtStart,
          accountAtEnd,
          dateStart,
          extra,
        } = this.getTradesReport(file, stockExchange);

        return {
          groupedTrades,
          accountAtStart,
          accountAtEnd,
          dateStart,
          extra,
        };
      }),
      sort(
        (report1, report2) =>
          new Date(report2.dateStart).getTime() -
          new Date(report1.dateStart).getTime(),
      ),
    )(files);
  }

  sortDeals(deals: Deal[]) {
    return sort((a, b) => a.ticker.localeCompare(b.ticker), deals);
  }

  getTotalValue(deals: Deal[]) {
    return deals.reduce((acc, deal) => acc + deal.total, 0);
  }

  getSummary(deals: Deal[], dividendReport?: DividendReport) {
    const total = this.getTotalValue(deals);

    return {
      total,
      totalTaxFee: this.getTotalTaxFee(total),
      totalMilitaryFee: this.getMilitaryFee(total),
      deals: this.sortDeals(deals),
      dividends: dividendReport ?? null,
    };
  }

  getTradesFromPreviousPeriod(
    groupedTrades: GroupedTrades,
    leftOvers?: AccounAtStartType,
  ) {
    const tradeService = new TradeService(this.dealsService, {
      trades: groupedTrades,
      leftOvers,
    });

    const trades = tradeService.getTradesFromPreviousPeriod();

    return { trades, leftOvers: tradeService.getLefovers() };
  }

  processTradesFromPreviousPeriod(
    tradeReports: ReportFromPreviousPeriod[],
    baseLeftOvers: AccounAtStartType,
  ) {
    return tradeReports.reduce(
      (acc, { groupedTrades }, index) => {
        if (index === 0) {
          return this.getTradesFromPreviousPeriod(groupedTrades, baseLeftOvers);
        } else {
          const { trades, leftOvers } = this.getTradesFromPreviousPeriod(
            groupedTrades,
            acc.leftOvers,
          );

          const mergedTrades: GroupedTrades = mergeDeepWith(
            concat,
            trades,
            acc.trades,
          );

          return {
            trades: mergedTrades,
            leftOvers,
          };
        }
      },
      {} as {
        leftOvers: AccounAtStartType;
        trades: GroupedTrades;
      },
    );
  }

  private detectStockExchange(file: Express.Multer.File): StockExchangeEnum {
    const content = file.buffer.toString('utf-8');

    try {
      const parsed = JSON.parse(content);
      if (
        typeof parsed.date_start === 'string' &&
        Array.isArray(parsed.trades?.detailed)
      ) {
        return StockExchangeEnum.FREEDOM_FINANCE;
      }
    } catch {
      // not JSON
    }

    // IBKR CSV files always contain section rows starting with "Statement,Header" or "Statement,Data"
    if (/^Statement,(Header|Data)/m.test(content)) {
      return StockExchangeEnum.IBRK_CSV;
    }

    throw new BadRequestException(
      'Unable to detect stock exchange. Supported formats: Freedom Finance (JSON) and IBKR (CSV).',
    );
  }

  private detectStockExchangeFromFiles(
    files: Express.Multer.File[],
  ): StockExchangeEnum {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const stockExchange = this.detectStockExchange(files[0]);

    for (const file of files.slice(1)) {
      if (this.detectStockExchange(file) !== stockExchange) {
        throw new BadRequestException(
          'All uploaded files must be from the same stock exchange (all JSON or all CSV)',
        );
      }
    }

    return stockExchange;
  }

  async processMultipleFiles({
    files,
  }: {
    files: Express.Multer.File[];
    user: User;
  }) {
    const stockExchange = this.detectStockExchangeFromFiles(files);

    const deals =
      stockExchange === StockExchangeEnum.IBRK_CSV
        ? await this.processIbkrCsvFiles(files, stockExchange)
        : await this.processFreedomFinanceFiles(files, stockExchange);

    const dividendReport = await this.processDividendsFromFiles(
      files,
      stockExchange,
    );

    return this.getSummary(deals, dividendReport);
  }

  private async processFreedomFinanceFiles(
    files: Express.Multer.File[],
    stockExchange: StockExchangeEnum,
  ) {
    const [firstReport, ...restReports] = this.getTradesByMultipleFiles(
      files,
      stockExchange,
    );

    const tradeService = new TradeService(this.dealsService, {
      trades: firstReport.groupedTrades,
    });

    const leftOvers = tradeService.getNeededTradesFromPreviousPeriod(
      firstReport.groupedTrades,
      firstReport.accountAtStart,
    );

    const prevTrades = this.processTradesFromPreviousPeriod(
      restReports,
      leftOvers,
    );

    if (Object.values(leftOvers).some((value) => value > 0)) {
      throw new BadRequestException('Not enough buy deals');
    }

    tradeService.setTrades(prevTrades.trades);

    return tradeService.getDeals();
  }

  private async processIbkrCsvFiles(
    files: Express.Multer.File[],
    stockExchange: StockExchangeEnum,
  ) {
    // Sort oldest → newest so FIFO processes earlier purchases before later sells
    const reports = this.getTradesByMultipleFiles(files, stockExchange).sort(
      (a, b) =>
        new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime(),
    );

    const mergedTrades: GroupedTrades = reports.reduce(
      (acc, report) => mergeDeepWith(concat, acc, report.groupedTrades),
      {} as GroupedTrades,
    );

    const tradeService = new TradeService(this.dealsService, {
      trades: mergedTrades,
    });

    const allDeals = await tradeService.getDeals();

    if (allDeals.length === 0) return allDeals;

    const lastYear = Math.max(
      ...reports.map((r) => new Date(r.dateStart).getFullYear()),
    );

    return allDeals.filter(
      (d) => new Date(d.sale.date).getFullYear() === lastYear,
    );
  }

  async processDemoReport({ file }: { file: Express.Multer.File }) {
    const stockExchange = this.detectStockExchange(file);
    const { groupedTrades } = this.getTradesReport(file, stockExchange);

    const tradeService = new TradeService(this.dealsService, {
      trades: groupedTrades,
    });

    const deals = await tradeService.getDemoTrades();

    return deals;
  }

  private async processDividendsFromFiles(
    files: Express.Multer.File[],
    stockExchange: StockExchangeEnum,
  ): Promise<DividendReport | null> {
    const supportedExchanges = [
      StockExchangeEnum.FREEDOM_FINANCE,
      StockExchangeEnum.IBRK_CSV,
    ];

    if (!supportedExchanges.includes(stockExchange)) {
      return null;
    }

    const allDividends = await Promise.all(
      files.map(async (file) => {
        const result = this.normalizeReportsService.getDividendsByStockExchange(
          file,
          stockExchange,
        );

        if (result.source === 'ibkr_csv') {
          return this.dividendService.processIbkrCsvDividends(result.dividends);
        }

        return this.dividendService.processDividends(result.corporateActions);
      }),
    );

    const flatDividends = allDividends.flat();

    if (flatDividends.length === 0) {
      return null;
    }

    const lastYear = Math.max(
      ...flatDividends.map((d) => new Date(d.date).getFullYear()),
    );

    return this.dividendService.calculateDividendReport(
      flatDividends.filter((d) => new Date(d.date).getFullYear() === lastYear),
    );
  }

  async getReports(userId: User['id']) {
    return await this.reportRepositoryService.getReports(userId);
  }

  private getTotalTaxFee(total: number) {
    if (total <= 0) {
      return 0;
    }

    return total * this.dealsTaxFee;
  }

  private getMilitaryFee(total: number) {
    if (total <= 0) {
      return 0;
    }

    return total * this.dealsMilitaryFee;
  }
}
