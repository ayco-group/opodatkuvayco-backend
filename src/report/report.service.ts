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
    const { trades, accountAtStart, accountAtEnd, dateStart } =
      this.normalizeReportsService.getReportByStockExchange(
        file,
        stockExchange,
      );

    const groupedTrades = this.dealsService.groupTradesByTicker(trades);

    return { groupedTrades, accountAtStart, accountAtEnd, dateStart };
  }

  getTradesByMultipleFiles(
    files: Express.Multer.File[],
    stockExchange: StockExchangeEnum,
  ) {
    return pipe(
      map((file: Express.Multer.File) => {
        const { groupedTrades, accountAtStart, accountAtEnd, dateStart } =
          this.getTradesReport(file, stockExchange);

        return { groupedTrades, accountAtStart, accountAtEnd, dateStart };
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

  async processMultipleFiles({
    files,
    stockExchange,
  }: {
    files: Express.Multer.File[];
    user: User;
    stockExchange: StockExchangeEnum;
  }) {
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

    const deals = await tradeService.getDeals();

    // Process dividends from all files
    const dividendReport = await this.processDividendsFromFiles(
      files,
      stockExchange,
    );

    return this.getSummary(deals, dividendReport);
  }

  async processDemoReport({
    file,
    stockExhange,
  }: {
    file: Express.Multer.File;
    stockExhange: StockExchangeEnum;
  }) {
    const { groupedTrades } = this.getTradesReport(file, stockExhange);

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
    if (stockExchange !== StockExchangeEnum.FREEDOM_FINANCE) {
      return null;
    }

    const allDividends = await Promise.all(
      files.map(async (file) => {
        const { corporateActions } =
          this.normalizeReportsService.getDividendsByStockExchange(
            file,
            stockExchange,
          );

        return this.dividendService.processDividends(corporateActions);
      }),
    );

    const flatDividends = allDividends.flat();

    if (flatDividends.length === 0) {
      return null;
    }

    return this.dividendService.calculateDividendReport(flatDividends);
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
