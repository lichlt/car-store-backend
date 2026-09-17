import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContentPage } from './entities/content-page.entity';
import { Showroom } from './entities/showroom.entity';
import { TeamMember } from './entities/team-member.entity';
import { Faq } from './entities/faq.entity';
import { BlogPost } from './entities/blog-post.entity';
import { User } from '../users/entities/user.entity';

import { CmsService } from './cms.service';
import { ContentController, PublicContentController } from './cms.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentPage,
      Showroom,
      TeamMember,
      Faq,
      BlogPost,
      User,
    ]),
  ],
  controllers: [PublicContentController, ContentController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
