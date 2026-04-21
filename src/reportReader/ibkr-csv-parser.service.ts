import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import {
  IbkrCsvRawReport,
  IbkrCsvRawTrade,
  IbkrCsvRawDividend,
  IbkrCsvRawInterest,
  IbkrCsvRawGrant,
  IbkrCsvRawCorporateAction,
} from './types/ibkr-csv-raw.interface';

@Injectable()
export class IbkrCsvParserService {
  parse(buffer: Buffer): IbkrCsvRawReport {
    const rows = parse(buffer, { relax_column_count: true }) as string[][];
    const sections = this.groupRowsBySections(rows);

    return {
      period: this.extractPeriod(sections),
      trades: this.extractFromSection<IbkrCsvRawTrade>(
        sections,
        'Trades',
        (row) => row[3] === 'Stocks',
      ),
      options: this.extractFromSection<IbkrCsvRawTrade>(
        sections,
        'Trades',
        (row) => row[3] === 'Equity and Index Options',
      ),
      treasuryBills: this.extractFromSection<IbkrCsvRawTrade>(
        sections,
        'Trades',
        (row) => row[3] === 'Treasury Bills',
      ),
      dividends: [
        ...this.extractFromSection<IbkrCsvRawDividend>(
          sections,
          'Dividends',
          (row) => !row[2]?.includes('Total'),
        ),
        ...this.extractFromSection<IbkrCsvRawDividend>(
          sections,
          'Withholding Tax',
          (row) => !row[2]?.includes('Total'),
        ),
      ],
      interest: this.extractFromSection<IbkrCsvRawInterest>(
        sections,
        'Interest',
        (row) => !row[2]?.includes('Total'),
      ),
      grants: this.extractFromSection<IbkrCsvRawGrant>(
        sections,
        'Grant Activity',
        (row) => row[2] !== 'SubTotal' && row[2] !== 'Total',
      ),
      corporateActions: this.extractFromSection<IbkrCsvRawCorporateAction>(
        sections,
        'Corporate Actions',
        (row) => row[2] !== 'Total in USD' && row[2] !== 'Total',
      ),
    };
  }

  private groupRowsBySections(
    rows: string[][],
  ): Map<string, { header: string[]; rows: string[][] }> {
    const sections = new Map<string, { header: string[]; rows: string[][] }>();

    for (const row of rows) {
      const [name, type] = row;
      if (!name) continue;

      const typeNormalized = type?.toLowerCase();
      if (typeNormalized === 'header') {
        if (sections.has(name)) {
          sections.get(name)!.header = row;
        } else {
          sections.set(name, { header: row, rows: [] });
        }
      } else if (typeNormalized === 'data') {
        if (!sections.has(name)) {
          sections.set(name, { header: [], rows: [] });
        }
        sections.get(name)!.rows.push(row);
      }
    }

    return sections;
  }

  private extractPeriod(
    sections: Map<string, { header: string[]; rows: string[][] }>,
  ): string {
    const statementRows = sections.get('Statement')?.rows ?? [];
    return statementRows.find((row) => row[2] === 'Period')?.[3] ?? '';
  }

  private extractFromSection<T>(
    sections: Map<string, { header: string[]; rows: string[][] }>,
    sectionName: string,
    filter?: (row: string[]) => boolean,
  ): T[] {
    const section = sections.get(sectionName);
    if (!section?.header.length) return [];

    return section.rows
      .filter((row) => !filter || filter(row))
      .map(
        (row) =>
          Object.fromEntries(
            section.header.map((key, i) => [key, row[i] ?? '']),
          ) as unknown as T,
      );
  }
}
