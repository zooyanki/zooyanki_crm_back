import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v1';

/// Шифрование секретов площадок: client_secret, access и refresh токены.
/// Формат: v1.<iv>.<authTag>.<ciphertext>, все части в base64url.
/// Версия в префиксе нужна, чтобы позже сменить алгоритм или ключ
/// без миграции уже сохранённых значений.
@Injectable()
export class CryptoService {
  constructor(private readonly config: AppConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.config.encryptionKey, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      VERSION,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const [version, ivPart, tagPart, dataPart] = payload.split('.');

    if (version !== VERSION || !ivPart || !tagPart || !dataPart) {
      throw new Error('Не удалось разобрать зашифрованное значение');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.config.encryptionKey,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }
}
