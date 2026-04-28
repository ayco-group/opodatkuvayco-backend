import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.quard';
import { Report } from './entities/report.entity';
import { UserRequest } from 'src/auth/types/userRequest';

@ApiTags('Report')
@Controller('report')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @UseGuards(JwtGuard)
  @Get('get-reports')
  @ApiResponse({
    status: 200,
    type: [Report],
  })
  getRepots(@Request() req: UserRequest): Promise<Report[]> {
    return this.reportService.getReports(req.user.id);
  }

  @Post('create-report')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype === 'application/json' ||
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only JSON (Freedom Finance) and CSV (IBKR) files are allowed.`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiBody({
    description: 'Upload report files — JSON for Freedom Finance, CSV for IBKR',
    required: true,
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Array of report files (JSON or CSV)',
        },
      },
    },
  })
  async processMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: UserRequest,
  ) {
    return await this.reportService.processMultipleFiles({
      files,
      user: req.user,
    });
  }

  @Post('create-demo-report')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype === 'application/json' ||
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only JSON (Freedom Finance) and CSV (IBKR) files are allowed.`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiBody({
    description:
      'Upload a single report file — JSON for Freedom Finance, CSV for IBKR',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JSON or CSV report file',
        },
      },
    },
  })
  async processDemoFile(@UploadedFile() file: Express.Multer.File) {
    return await this.reportService.processDemoReport({ file });
  }
}
