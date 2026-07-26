import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const appService = {
      getHealth: jest.fn().mockReturnValue({
        status: 'ok',
        database: 'connected',
        timestamp: '2026-07-26T00:00:00.000Z',
      }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return the service health result', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        database: 'connected',
        timestamp: '2026-07-26T00:00:00.000Z',
      });
    });
  });
});
