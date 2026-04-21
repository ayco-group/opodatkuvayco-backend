import { GroupedTrades } from './trade.interface';
import {
  IbkrCsvDividend,
  IbkrCsvOption,
  IbkrCsvInterest,
  IbkrCsvGrant,
  IbkrCsvTreasuryBill,
  IbkrCsvCorporateAction,
} from 'src/normalizeReports/types/interfaces/ibkr-csv.interface';

interface AccounAtStart {
  ticker: string;
  quantity: number;
}

export type AccounAtStartType = Record<
  AccounAtStart['ticker'],
  AccounAtStart['quantity']
>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type BaseReportExtra = {};

export interface IbkrCsvReportExtra {
  dividends: IbkrCsvDividend[];
  options: IbkrCsvOption[];
  interest: IbkrCsvInterest[];
  grants: IbkrCsvGrant[];
  treasuryBills: IbkrCsvTreasuryBill[];
  corporateActions: IbkrCsvCorporateAction[];
}

export interface Report<T, TExtra = BaseReportExtra> {
  dateStart: string;
  trades: T[];
  accountAtStart?: AccounAtStartType;
  accountAtEnd?: AccounAtStartType;
  extra: TExtra;
}

export type ReportFromPreviousPeriod = Omit<Report<object>, 'trades'> & {
  groupedTrades: GroupedTrades;
};
