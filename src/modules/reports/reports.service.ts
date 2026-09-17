import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ReportJob, ReportJobStatus } from './report-job.entity';
import { CreateReportDto } from './reports.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ReportJob)
    private readonly reportJobRepo: Repository<ReportJob>,
  ) {}

  /**
   * Enqueues an asynchronous report generation job and simulates processing via setImmediate.
   */
  async createJob(dto: CreateReportDto, userId: string): Promise<ReportJob> {
    const job = this.reportJobRepo.create({
      type: dto.type,
      status: ReportJobStatus.PENDING,
      filters: dto.filters ?? null,
      fileUrl: null,
      createdBy: userId,
    });

    const savedJob = await this.reportJobRepo.save(job);
    const jobId = savedJob.id;

    // Asynchronous background processing simulation
    setImmediate(async () => {
      try {
        await this.reportJobRepo.update(jobId, {
          status: ReportJobStatus.PROCESSING,
        });

        // Generate mock export URL
        const mockFileUrl = `/api/reports/download/${jobId}-${dto.type}.csv`;

        await this.reportJobRepo.update(jobId, {
          status: ReportJobStatus.DONE,
          fileUrl: mockFileUrl,
        });

        this.logger.log(`Report job '${jobId}' (${dto.type}) completed successfully`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Report job '${jobId}' failed: ${errorMsg}`);
        await this.reportJobRepo.update(jobId, {
          status: ReportJobStatus.FAILED,
        });
      }
    });

    return savedJob;
  }

  /**
   * Retrieves status and download link of a report job, ensuring user ownership.
   */
  async getJob(id: string, userId: string): Promise<ReportJob> {
    const job = await this.reportJobRepo.findOne({ where: { id } });

    if (!job) {
      throw new NotFoundException(`Report job with ID '${id}' not found`);
    }

    if (job.createdBy !== userId) {
      throw new ForbiddenException('You do not have permission to view this report job');
    }

    return job;
  }
}
