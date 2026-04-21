export interface IbkrCsvRawTrade {
  DataDiscriminator: string;
  'Asset Category': string;
  Currency: string;
  Symbol: string;
  'Date/Time': string;
  Quantity: string;
  'T. Price': string;
  'C. Price': string;
  Proceeds: string;
  'Comm/Fee': string;
  Basis: string;
  'Realized P/L': string;
  'MTM P/L': string;
  Code: string;
}

export interface IbkrCsvRawDividend {
  Currency: string;
  Date: string;
  Description: string;
  Amount: string;
  Code: string;
}

export interface IbkrCsvRawInterest {
  Currency: string;
  Date: string;
  Description: string;
  Amount: string;
}

export interface IbkrCsvRawGrant {
  Symbol: string;
  'Report Date': string;
  Description: string;
  'Award Date': string;
  'Vesting Date': string;
  Quantity: string;
  Price: string;
  Value: string;
}

export interface IbkrCsvRawCorporateAction {
  'Asset Category': string;
  Currency: string;
  'Report Date': string;
  Date: string;
  Description: string;
  Quantity: string;
  Proceeds: string;
  Value: string;
  'Realized P/L': string;
  Code: string;
}

export interface IbkrCsvRawReport {
  period: string;
  trades: IbkrCsvRawTrade[];
  options: IbkrCsvRawTrade[];
  treasuryBills: IbkrCsvRawTrade[];
  dividends: IbkrCsvRawDividend[];
  interest: IbkrCsvRawInterest[];
  grants: IbkrCsvRawGrant[];
  corporateActions: IbkrCsvRawCorporateAction[];
}
