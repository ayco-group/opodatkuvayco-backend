import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyRateService } from 'src/currencyExchange/currencyRate.service';
import { FreedomFinanceCorporateAction } from 'src/normalizeReports/types/interfaces/freedomFinance.interface';
import { IbkrCsvDividend } from 'src/normalizeReports/types/interfaces/ibkr-csv.interface';
import {
  Dividend,
  DividendReport,
} from './types/interfaces/dividend.interface';
import {
  DEFAULT_DIVIDENDS_TAX_FEE,
  DEFAULT_MILITARY_FEE,
  TAX_CONFIG_KEYS,
} from './consts/tax-fee-percentages';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DividendService {
  private readonly dividendsTaxFee: number;
  private readonly dividendsMilitaryFee: number;

  constructor(
    private currencyRateService: CurrencyRateService,
    private configService: ConfigService,
  ) {
    this.dividendsTaxFee = Number(
      this.configService.get(
        TAX_CONFIG_KEYS.DIVIDENDS_TAX_FEE,
        DEFAULT_DIVIDENDS_TAX_FEE,
      ),
    );
    this.dividendsMilitaryFee = Number(
      this.configService.get(
        TAX_CONFIG_KEYS.MILITARY_FEE,
        DEFAULT_MILITARY_FEE,
      ),
    );
  }

  filterDividends(
    corporateActions: FreedomFinanceCorporateAction[],
  ): FreedomFinanceCorporateAction[] {
    return corporateActions.filter((action) => action.type_id === 'dividend');
  }

  async processDividend(
    action: FreedomFinanceCorporateAction,
  ): Promise<Dividend> {
    const { rate } = await this.currencyRateService.getCurrencyExchange(
      action.currency,
      action.date,
    );

    const externalTax = Math.abs(
      typeof action.external_tax === 'string'
        ? parseFloat(action.external_tax)
        : action.external_tax || 0,
    );

    const quantity =
      typeof action.q_on_ex_date === 'string'
        ? parseFloat(action.q_on_ex_date)
        : action.q_on_ex_date || 0;

    return {
      id: uuid(),
      date: new Date(action.date),
      ticker: action.ticker,
      isin: action.isin,
      currency: action.currency,
      amount: action.amount,
      amountPerOne: action.amount_per_one,
      quantity,
      externalTax,
      externalTaxCurrency: action.external_tax_currency,
      rate,
      amountUah: action.amount * rate,
      externalTaxUah: externalTax * rate,
    };
  }

  async processDividends(
    corporateActions: FreedomFinanceCorporateAction[],
  ): Promise<Dividend[]> {
    const dividendActions = this.filterDividends(corporateActions);

    const dividends = await Promise.all(
      dividendActions.map((action) => this.processDividend(action)),
    );

    return dividends;
  }

  async processIbkrCsvDividends(
    rawDividends: IbkrCsvDividend[],
  ): Promise<Dividend[]> {
    return Promise.all(
      rawDividends.map(async (d) => {
        const { rate } = await this.currencyRateService.getCurrencyExchange(
          d.currency,
          d.date,
        );

        // Description format: "AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend)"
        const ticker = d.description.split('(')[0].trim();

        return {
          id: uuid(),
          date: new Date(d.date),
          ticker,
          isin: '',
          currency: d.currency,
          amount: d.amount,
          amountPerOne: 0,
          quantity: 0,
          externalTax: 0,
          externalTaxCurrency: d.currency,
          rate,
          amountUah: d.amount * rate,
          externalTaxUah: 0,
        };
      }),
    );
  }

  calculateDividendReport(dividends: Dividend[]): DividendReport {
    const totalAmountUah = dividends.reduce(
      (acc, div) => acc + div.amountUah,
      0,
    );

    const pdfo = totalAmountUah > 0 ? totalAmountUah * this.dividendsTaxFee : 0;
    const militaryFee =
      totalAmountUah > 0 ? totalAmountUah * this.dividendsMilitaryFee : 0;

    return {
      dividends: this.sortDividends(dividends),
      totalAmountUah,
      pdfo,
      militaryFee,
    };
  }

  private sortDividends(dividends: Dividend[]): Dividend[] {
    return [...dividends].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }
}
