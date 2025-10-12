import { Injectable } from '@nestjs/common';
import * as cls from 'cls-hooked';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdService {
  private static readonly NAMESPACE = 'correlation-context';
  private static readonly CORRELATION_ID_KEY = 'correlationId';
  
  private namespace = cls.createNamespace(CorrelationIdService.NAMESPACE);

  generateId(): string {
    return uuidv4();
  }

  getId(): string | undefined {
    return this.namespace.get(CorrelationIdService.CORRELATION_ID_KEY);
  }

  setId(id: string): void {
    this.namespace.set(CorrelationIdService.CORRELATION_ID_KEY, id);
  }

  run<T>(id: string, fn: () => T): T {
    return this.namespace.run(() => {
      this.setId(id);
      return fn();
    });
  }
}