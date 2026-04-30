import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  private confirmEmailEndpoint(token: string) {
    return `${this.configService.get<string>('APP_URL')}/auth/confirm-email?token=${token}`;
  }

  async sendEmailConfirmation(email: string, token: string) {
    const confirmationUrl = this.confirmEmailEndpoint(token);

    await this.mailerService.sendMail({
      from: this.configService.get('MAIL_ADRESS'),
      to: email,
      subject: 'Confirm your email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Email Confirmation</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .email-container {
              background-color: #fff;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              padding: 30px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              max-height: 60px;
              margin-bottom: 20px;
            }
            h1 {
              color: #00ff94;
              font-size: 24px;
              margin: 0;
            }
            .content {
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              background-color: #00ff94;
              color: white;
              text-decoration: none;
              padding: 12px 25px;
              border-radius: 5px;
              font-weight: bold;
              text-align: center;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #3a70b2;
            }
            .footer {
              font-size: 12px;
              color: #999999;
              text-align: center;
              margin-top: 30px;
              border-top: 1px solid #eeeeee;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Opodatkuvayco</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for registering with Opodatkuvayco! To complete your registration and verify your email address, please click the button below:</p>
              <div style="text-align: center;">
                <a href="${confirmationUrl}" class="button">Confirm Email Address</a>
              </div>
              <p>If you did not create an account, you can safely ignore this email.</p>
              <p>If the button above doesn't work, you can also copy and paste the following link into your browser:</p>
              <p style="word-break: break-all; font-size: 12px;">${confirmationUrl}</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Opodatkuvayco. All rights reserved.</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }
}
