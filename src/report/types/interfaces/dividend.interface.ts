export interface Dividend {
  id: string;
  date: Date;
  ticker: string;
  isin: string;
  currency: string;
  amount: number;
  amountPerOne: number;
  quantity: number;
  externalTax: number;
  externalTaxCurrency: string;
  rate: number;
  amountUah: number;
  externalTaxUah: number;
}

export interface DividendReport {
  dividends: Dividend[];
  totalAmountUah: number;
  pdfo: number;
  militaryFee: number;
}
