import { FreedomFinanceTrade } from 'src/normalizeReports/types/interfaces/freedomFinance.interface';
import { IbkrTrade } from 'src/normalizeReports/types/interfaces/ibkr.interface';
import { IbkrCsvRawTrade } from 'src/reportReader/types/ibkr-csv-raw.interface';
import { StockExchangeEnum } from 'src/normalizeTrades/constants/enums';

export type StockExchangeType =
  | StockExchangeEnum.FREEDOM_FINANCE
  | StockExchangeEnum.IBRK
  | StockExchangeEnum.IBRK_CSV;

export type TradesByStockExchange = {
  [StockExchangeEnum.FREEDOM_FINANCE]: FreedomFinanceTrade[];
  [StockExchangeEnum.IBRK]: IbkrTrade[];
  [StockExchangeEnum.IBRK_CSV]: IbkrCsvRawTrade[];
};
