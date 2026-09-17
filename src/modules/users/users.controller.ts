import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { UsersService } from './users.service';
import {
  ListUsersDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateRoleDto,
} from './users.dto';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/types/jwt-payload.interface';

// ──────────────────────────────────────────────────────────────────────────────
// UsersController
// Route prefix comes from the app-level global prefix + module route: /api/admins
// ──────────────────────────────────────────────────────────────────────────────
@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admins')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── List users ────────────────────────────────────────────────────────────
  @Get()
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'List admin users with optional filters and pagination' })
  findAll(@Query() dto: ListUsersDto): Promise<PaginatedResult<User>> {
    return this.usersService.findAll(dto);
  }

  // ─── Create user ───────────────────────────────────────────────────────────
  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Create a new admin user' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<User> {
    return this.usersService.create(dto, actor.sub);
  }

  // ─── Get user by ID ────────────────────────────────────────────────────────
  @Get(':id')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Get a single admin user by UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  // ─── Update user ───────────────────────────────────────────────────────────
  @Patch(':id')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Update a user\'s profile fields' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, dto);
  }

  // ─── Delete user ───────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.delete')
  @ApiOperation({ summary: 'Soft-delete a user (sets deletedAt)' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  // ─── Change user role ──────────────────────────────────────────────────────
  @Patch(':id/role')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Assign a different role to a user' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<User> {
    return this.usersService.updateRole(id, dto);
  }

  // ─── Roles reference list ──────────────────────────────────────────────────
  @Get('/roles')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List all available roles with their permissions' })
  findRoles(): Promise<Role[]> {
    return this.usersService.findRoles();
  }

  // ─── Permissions reference list ────────────────────────────────────────────
  @Get('/permissions')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List all defined permissions' })
  findPermissions(): Promise<Permission[]> {
    return this.usersService.findPermissions();
  }
}
