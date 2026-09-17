import { Injectable } from '@nestjs/common';
import { MolAuthGuard } from './mol-auth.guard';

@Injectable()
export class JwtAuthGuard extends MolAuthGuard {}
