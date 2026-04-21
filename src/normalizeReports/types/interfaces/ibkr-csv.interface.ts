export interface IbkrCsvTrade {
  ticker: string;
  currency: string;
  date: string;
  price: number;
  commission: number;
  quantity: number;
  proceeds: number;
  realizedPL: number;
  basis: number;
  operation: 'BUY' | 'SELL';
}

export interface IbkrCsvOption {
  ticker: string;
  currency: string;
  date: string;
  price: number;
  commission: number;
  quantity: number;
  proceeds: number;
  code: string;
}

export interface IbkrCsvDividend {
  currency: string;
  date: string;
  amount: number;
  description: string;
}

export interface IbkrCsvInterest {
  currency: string;
  date: string;
  amount: number;
  description: string;
}

export interface IbkrCsvGrant {
  symbol: string;
  reportDate: string;
  description: string;
  awardDate: string;
  vestingDate: string;
  quantity: number;
  price: number;
  value: number;
}

export interface IbkrCsvCorporateAction {
  currency: string;
  date: string;
  description: string;
  realizedPL: number;
}

export interface IbkrCsvTreasuryBill {
  ticker: string;
  currency: string;
  date: string;
  price: number;
  commission: number;
  quantity: number;
  proceeds: number;
  profit: number;
}
