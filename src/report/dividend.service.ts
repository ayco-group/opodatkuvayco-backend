import { Injectable } from '@nestjs/common';
import { CurrencyRateService } from 'src/currencyExchange/currencyRate.service';
import { FreedomFinanceCorporateAction } from 'src/normalizeReports/types/interfaces/freedomFinance.interface';
import {
  Dividend,
  DividendReport,
} from './types/interfaces/dividend.interface';
import { MILITARY_FEE, TAX_FEE } from './consts/tax-fee-percentages';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DividendService {
  constructor(private currencyRateService: CurrencyRateService) {}

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

  calculateDividendReport(dividends: Dividend[]): DividendReport {
    const totalAmountUah = dividends.reduce(
      (acc, div) => acc + div.amountUah,
      0,
    );

    const pdfo = totalAmountUah > 0 ? totalAmountUah * TAX_FEE : 0;
    const militaryFee = totalAmountUah > 0 ? totalAmountUah * MILITARY_FEE : 0;

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
