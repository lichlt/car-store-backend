import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Liveness probe — always returns 200 if the process is running.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe — verifies the database connection is available.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks DB connectivity)' })
  async ready(): Promise<{ status: string; db: string }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', db: 'connected' };
  }
}
