import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { IbkrCsvParserService } from './ibkr-csv-parser.service';
import { FileTypeEnum } from './consts';
import { FileType } from './types';

@Injectable()
export class ReportReaderService {
  constructor(private readonly ibkrCsvParser: IbkrCsvParserService) {}

  private xmlParser = new XMLParser({
    allowBooleanAttributes: true,
    attributeNamePrefix: '',
    ignoreAttributes: false,
  });

  private PARSER_BY_FILE_MAP = {
    [FileTypeEnum.JSON]: this.parseJSON.bind(this),
    [FileTypeEnum.XML]: this.parseXml.bind(this),
    [FileTypeEnum.CSV]: this.parseCSV.bind(this),
  };

  readReport(file: Express.Multer.File, fileType: FileType) {
    return this.PARSER_BY_FILE_MAP[fileType](file);
  }

  private parseXml(file: Express.Multer.File) {
    try {
      return this.xmlParser.parse(file.buffer);
    } catch (error) {
      throw new Error('Error parsing xml');
    }
  }

  private parseJSON(file: Express.Multer.File) {
    try {
      return JSON.parse(file.buffer.toString('utf-8'));
    } catch (error) {
      throw new Error('Error parsing json');
    }
  }

  private parseCSV(file: Express.Multer.File) {
    return this.ibkrCsvParser.parse(file.buffer);
  }
}
