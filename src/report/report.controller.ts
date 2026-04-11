import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.quard';
import { Report } from './entities/report.entity';
import { UserRequest } from 'src/auth/types/userRequest';
import { ReportDealsDto } from './dto/report-deals.dto';

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
          file.mimetype === 'application/xml'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only JSON and XML files are allowed.`,
            ),
            false,
          );
        }
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBody({
    description: 'Upload multiple JSON files containing trades report',
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
          description: 'Array of JSON files containing trades report',
        },
      },
    },
  })
  async processMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: UserRequest,
    @Query() query: ReportDealsDto,
  ) {
    return await this.reportService.processMultipleFiles({
      files,
      user: req.user,
      stockExchange: query.stockExchange,
    });
  }

  @Post('create-demo-report')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype === 'application/json' ||
          file.mimetype === 'application/xml'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException(
              `Invalid file type: ${file.mimetype}. Only JSON and XML files are allowed.`,
            ),
            false,
          );
        }
      },
    }),
  )
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiBody({
    description: 'Upload JSON or XML file containing trades report',
    required: true,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JSON or XML file containing trades report',
        },
      },
    },
  })
  async processDemoFile(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ReportDealsDto,
  ) {
    return await this.reportService.processDemoReport({
      file,
      stockExhange: query.stockExchange,
    });
  }
}
